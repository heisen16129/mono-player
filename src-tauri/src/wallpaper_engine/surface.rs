use super::capture::Capture;
use super::sampling::CropSpec;
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use windows::{
    core::w,
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM},
        Graphics::{Dwm::*, Gdi::*},
        System::{
            Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
            LibraryLoader::GetModuleHandleW,
            WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED},
        },
        UI::{
            Shell::{ITaskbarList, TaskbarList},
            WindowsAndMessaging::*,
        },
    },
};

#[derive(Default)]
pub(super) struct Sample {
    pub bytes: Vec<u8>,
    pub requested: Option<Instant>,
    pub crop: Option<CropSpec>,
}

pub(super) struct Surface {
    stop: Arc<AtomicBool>,
    pub alive: Arc<AtomicBool>,
    pub sample: Arc<Mutex<Sample>>,
    worker: Option<thread::JoinHandle<()>>,
}

impl Surface {
    pub fn start(host: isize, source: isize, title: String) -> Result<Self, String> {
        let stop = Arc::new(AtomicBool::new(false));
        let alive = Arc::new(AtomicBool::new(false));
        let sample = Arc::new(Mutex::new(Sample::default()));
        let (sender, ready) = mpsc::sync_channel(1);
        let flags = (stop.clone(), alive.clone(), sample.clone());
        let worker = thread::spawn(move || {
            let (stop, alive, sample) = flags;
            unsafe {
                let initialized = RoInitialize(RO_INIT_MULTITHREADED).is_ok();
                let result = NativeSurface::new(HWND(host as _), HWND(source as _), title);
                match result {
                    Ok(mut native) => {
                        alive.store(true, Ordering::Release);
                        let _ = sender.send(Ok(()));
                        let mut last_sample = Instant::now() - Duration::from_secs(1);
                        while !stop.load(Ordering::Acquire) {
                            let mut message = MSG::default();
                            while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
                                let _ = TranslateMessage(&message);
                                DispatchMessageW(&message);
                            }
                            match native.follow() {
                                Ok(true) => {
                                    if last_sample.elapsed() >= Duration::from_millis(16) {
                                        let request = sample.lock().ok().and_then(|s| {
                                            s.requested
                                                .filter(|at| at.elapsed() < Duration::from_secs(1))
                                                .map(|_| s.crop)
                                        });
                                        if let Some(crop) = request {
                                            if let Some(capture) = native.capture.as_mut() {
                                                if let Ok(Some(bytes)) = capture.frame(crop) {
                                                    if let Ok(mut s) = sample.lock() {
                                                        if s.crop == crop {
                                                            s.bytes = bytes;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        last_sample = Instant::now();
                                    }
                                }
                                Ok(false) => {
                                    if let Ok(mut s) = sample.lock() {
                                        s.bytes.clear();
                                    }
                                }
                                Err(error) => {
                                    eprintln!("[Wallpaper Engine] 背景窗口已停止：{error}");
                                    break;
                                }
                            }
                            thread::sleep(Duration::from_millis(8));
                        }
                        drop(native);
                    }
                    Err(error) => {
                        let _ = sender.send(Err(error.to_string()));
                    }
                }
                alive.store(false, Ordering::Release);
                if let Ok(mut s) = sample.lock() {
                    s.bytes.clear();
                }
                if initialized {
                    RoUninitialize();
                }
            }
        });
        let surface = Self {
            stop,
            alive,
            sample,
            worker: Some(worker),
        };
        ready
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "背景窗口创建超时".to_string())??;
        Ok(surface)
    }
}

impl Drop for Surface {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

struct NativeSurface {
    host: HWND,
    source: HWND,
    window: HWND,
    title: String,
    thumbnail: isize,
    capture: Option<Capture>,
    dimensions: (i32, i32, i32),
}

unsafe extern "system" fn window_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    match msg {
        WM_NCHITTEST => LRESULT(HTTRANSPARENT as isize),
        WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
        _ => DefWindowProcW(hwnd, msg, wp, lp),
    }
}

impl NativeSurface {
    unsafe fn new(host: HWND, source: HWND, title: String) -> windows::core::Result<Self> {
        let instance = GetModuleHandleW(None)?;
        let class = WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance.into(),
            lpszClassName: w!("MonoWallpaperBackground"),
            hbrBackground: HBRUSH(GetStockObject(BLACK_BRUSH).0),
            ..Default::default()
        };
        RegisterClassW(&class);
        // This is a separate top-level DWM target, never the WebView's HWND.
        let window = CreateWindowExW(
            WS_EX_NOACTIVATE,
            class.lpszClassName,
            w!("Mono Wallpaper Background"),
            WS_POPUP,
            0,
            0,
            64,
            64,
            None,
            None,
            Some(instance.into()),
            None,
        )?;
        let mut native = Self {
            host,
            source,
            window,
            title,
            thumbnail: 0,
            capture: None,
            dimensions: (0, 0, 0),
        };
        native.follow()?;
        // Prime WGC before attaching the DWM thumbnail, as in Mineradio.
        let mut capture = Capture::new(window)?;
        let baseline = wait_for_capture_signature(&mut capture, Duration::from_secs(2))?;
        native.thumbnail = DwmRegisterThumbnail(window, source)?;
        native.follow()?;
        wait_for_changed_capture_signature(&mut capture, baseline, Duration::from_secs(4))?;
        native.capture = Some(capture);
        if let Ok(taskbar) =
            CoCreateInstance::<_, ITaskbarList>(&TaskbarList, None, CLSCTX_INPROC_SERVER)
        {
            let _ = taskbar.HrInit();
            let _ = taskbar.DeleteTab(window);
            let _ = taskbar.DeleteTab(source);
        }
        Ok(native)
    }

    unsafe fn follow(&mut self) -> windows::core::Result<bool> {
        if !IsWindow(Some(self.host)).as_bool() || !IsWindow(Some(self.source)).as_bool() {
            return Err(windows::core::Error::from_win32());
        }
        let mut title = [0u16; 256];
        let count = GetWindowTextW(self.source, &mut title);
        if String::from_utf16_lossy(&title[..count.max(0) as usize]) != self.title {
            return Err(windows::core::Error::new(
                windows::core::HRESULT(0x80004005u32 as i32),
                "Wallpaper window changed",
            ));
        }
        if !IsWindowVisible(self.host).as_bool() || IsIconic(self.host).as_bool() {
            let _ = ShowWindow(self.window, SW_HIDE);
            let _ = ShowWindow(self.source, SW_HIDE);
            return Ok(false);
        }
        let mut rect = RECT::default();
        GetWindowRect(self.host, &mut rect)?;
        let width = (rect.right - rect.left).max(1);
        let height = (rect.bottom - rect.top).max(1);
        let flags = SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW;
        if self.thumbnail == 0 {
            SetWindowPos(
                self.source,
                Some(self.host),
                rect.left,
                rect.top,
                width,
                height,
                flags,
            )?;
            SetWindowPos(
                self.window,
                Some(self.source),
                rect.left,
                rect.top,
                width,
                height,
                flags,
            )?;
        } else {
            SetWindowPos(
                self.window,
                Some(self.host),
                rect.left,
                rect.top,
                width,
                height,
                flags,
            )?;
            SetWindowPos(
                self.source,
                Some(self.window),
                rect.left,
                rect.top,
                width,
                height,
                flags,
            )?;
        }
        let mut monitor = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let fullscreen = GetMonitorInfoW(
            MonitorFromWindow(self.host, MONITOR_DEFAULTTONEAREST),
            &mut monitor,
        )
        .as_bool()
            && rect.left <= monitor.rcMonitor.left
            && rect.top <= monitor.rcMonitor.top
            && rect.right >= monitor.rcMonitor.right
            && rect.bottom >= monitor.rcMonitor.bottom;
        let radius = if IsZoomed(self.host).as_bool() || fullscreen {
            0
        } else {
            8
        };
        if (width, height, radius) != self.dimensions {
            for hwnd in [self.window, self.source] {
                let region = if radius == 0 {
                    HRGN::default()
                } else {
                    CreateRoundRectRgn(0, 0, width + 1, height + 1, radius * 2, radius * 2)
                };
                if SetWindowRgn(hwnd, Some(region), true) == 0 && !region.is_invalid() {
                    let _ = DeleteObject(region.into());
                }
            }
            self.dimensions = (width, height, radius);
        }
        if self.thumbnail != 0 {
            DwmUpdateThumbnailProperties(
                self.thumbnail,
                &DWM_THUMBNAIL_PROPERTIES {
                    dwFlags: DWM_TNP_RECTDESTINATION
                        | DWM_TNP_OPACITY
                        | DWM_TNP_VISIBLE
                        | DWM_TNP_SOURCECLIENTAREAONLY,
                    rcDestination: RECT {
                        left: 0,
                        top: 0,
                        right: width,
                        bottom: height,
                    },
                    opacity: 255,
                    fVisible: true.into(),
                    fSourceClientAreaOnly: true.into(),
                    ..Default::default()
                },
            )?;
        }
        Ok(true)
    }
}

fn wait_for_capture_signature(
    capture: &mut Capture,
    timeout: Duration,
) -> windows::core::Result<u64> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(signature) = capture.signature()? {
            return Ok(signature);
        }
        if Instant::now() >= deadline {
            return Err(windows::core::Error::new(
                windows::core::HRESULT(0x80004005u32 as i32),
                "Wallpaper Engine 播放栏采集首帧超时",
            ));
        }
        thread::sleep(Duration::from_millis(16));
    }
}

fn wait_for_changed_capture_signature(
    capture: &mut Capture,
    baseline: u64,
    timeout: Duration,
) -> windows::core::Result<()> {
    let deadline = Instant::now() + timeout;
    loop {
        if capture
            .signature()?
            .is_some_and(|signature| signature != baseline)
        {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(windows::core::Error::new(
                windows::core::HRESULT(0x80004005u32 as i32),
                "Wallpaper Engine 已启动，但播放栏采集画面没有更新",
            ));
        }
        thread::sleep(Duration::from_millis(16));
    }
}

impl Drop for NativeSurface {
    fn drop(&mut self) {
        self.capture.take();
        unsafe {
            if self.thumbnail != 0 {
                let _ = DwmUnregisterThumbnail(self.thumbnail);
            }
            let _ = ShowWindow(self.source, SW_HIDE);
            let _ = DestroyWindow(self.window);
        }
    }
}
