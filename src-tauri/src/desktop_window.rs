use crate::api_response::ApiResponse;

#[tauri::command]
pub(crate) fn resize_desktop_lyrics(window: tauri::WebviewWindow, width: f64, height: f64, preserve_center: bool) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        if !matches!(window.label(), "desktop-lyrics" | "desktop-playback-card") {
            return Err("Not a desktop lyrics window".into());
        }
        if !width.is_finite() || !height.is_finite() || width < 100.0 || height < 50.0 || width > 2000.0 || height > 1200.0 {
            return Err("Invalid desktop lyrics size".into());
        }
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let size = window.outer_size().map_err(|e| e.to_string())?;
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let w = (width * scale).round() as i32;
        let h = (height * scale).round() as i32;
        let x = position.x + if preserve_center { (size.width as i32 - w) / 2 } else { 0 };
        let y = position.y + if preserve_center { (size.height as i32 - h) / 2 } else { 0 };
        #[cfg(windows)]
        {
            use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};
            let hwnd = window.hwnd().map_err(|e| e.to_string())?;
            let ok = unsafe { SetWindowPos(hwnd.0 as _, std::ptr::null_mut(), x, y, w, h, SWP_NOACTIVATE | SWP_NOZORDER) };
            if ok == 0 { return Err(std::io::Error::last_os_error().to_string()); }
        }
        #[cfg(not(windows))]
        {
            window.set_size(tauri::PhysicalSize::new(w as u32, h as u32)).map_err(|e| e.to_string())?;
            window.set_position(tauri::PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        }
        Ok(())
    })())
}
