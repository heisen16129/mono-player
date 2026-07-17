use serde::Deserialize;
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
    SeekDirection,
};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub(crate) struct SystemMediaState {
    controls: Mutex<Option<MediaControls>>,
    metadata_key: Mutex<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SystemMediaUpdateRequest {
    title: String,
    artist: Option<String>,
    album: Option<String>,
    artwork: Option<String>,
    track_path: Option<String>,
    duration: Option<f64>,
    position: f64,
    is_playing: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemMediaAction {
    action: String,
    position: Option<f64>,
    offset: Option<f64>,
}

impl SystemMediaState {
    fn disabled() -> Self {
        Self {
            controls: Mutex::new(None),
            metadata_key: Mutex::new(None),
        }
    }
}

pub(crate) fn init(app: &AppHandle) -> SystemMediaState {
    set_platform_app_identity();

    let config = PlatformConfig {
        display_name: "Mono Player",
        dbus_name: "mono_player",
        hwnd: platform_hwnd(app),
    };

    let mut controls = match MediaControls::new(config) {
        Ok(controls) => controls,
        Err(err) => {
            eprintln!("System media controls unavailable: {err}");
            return SystemMediaState::disabled();
        }
    };

    let app_handle = app.clone();
    if let Err(err) = controls.attach(move |event| {
        if let Some(action) = map_media_event(event) {
            let _ = app_handle.emit("system-media://action", action);
        }
    }) {
        eprintln!("System media controls attach failed: {err}");
        return SystemMediaState::disabled();
    }

    SystemMediaState {
        controls: Mutex::new(Some(controls)),
        metadata_key: Mutex::new(None),
    }
}

#[tauri::command]
pub(crate) fn system_media_update(
    app: AppHandle,
    state: tauri::State<SystemMediaState>,
    request: SystemMediaUpdateRequest,
) -> Result<(), String> {
    let cover_url = resolve_cover_url(&app, &request);
    let mut guard = state.controls.lock().map_err(|err| err.to_string())?;
    let Some(controls) = guard.as_mut() else {
        return Ok(());
    };

    let duration = request.duration.and_then(seconds_to_duration);
    let position = seconds_to_duration(request.position);
    let metadata_key = request.metadata_key(cover_url.as_deref());

    if state.should_update_metadata(&metadata_key)? {
        let metadata_result = controls.set_metadata(MediaMetadata {
            title: Some(request.title.as_str()),
            album: request.album.as_deref(),
            artist: request.artist.as_deref(),
            cover_url: cover_url.as_deref(),
            duration,
        });
        if let Err(err) = metadata_result {
            if cover_url.is_none() {
                return Err(err.to_string());
            }

            eprintln!("System media cover update skipped: {err}");
            controls
                .set_metadata(MediaMetadata {
                    title: Some(request.title.as_str()),
                    album: request.album.as_deref(),
                    artist: request.artist.as_deref(),
                    cover_url: None,
                    duration,
                })
                .map_err(|err| err.to_string())?;
        }
    }

    let progress = position.map(MediaPosition);
    let playback = if request.is_playing {
        MediaPlayback::Playing { progress }
    } else {
        MediaPlayback::Paused { progress }
    };

    controls
        .set_playback(playback)
        .map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
pub(crate) fn system_media_clear(state: tauri::State<SystemMediaState>) -> Result<(), String> {
    state.clear_metadata_key()?;
    let mut guard = state.controls.lock().map_err(|err| err.to_string())?;
    let Some(controls) = guard.as_mut() else {
        return Ok(());
    };

    controls
        .set_playback(MediaPlayback::Stopped)
        .map_err(|err| err.to_string())
}

impl SystemMediaState {
    fn should_update_metadata(&self, key: &str) -> Result<bool, String> {
        let mut guard = self.metadata_key.lock().map_err(|err| err.to_string())?;
        if guard.as_deref() == Some(key) {
            return Ok(false);
        }

        *guard = Some(key.to_string());
        Ok(true)
    }

    fn clear_metadata_key(&self) -> Result<(), String> {
        let mut guard = self.metadata_key.lock().map_err(|err| err.to_string())?;
        *guard = None;
        Ok(())
    }
}

impl SystemMediaUpdateRequest {
    fn metadata_key(&self, cover_url: Option<&str>) -> String {
        [
            self.title.as_str(),
            self.artist.as_deref().unwrap_or_default(),
            self.album.as_deref().unwrap_or_default(),
            cover_url.unwrap_or_default(),
            &self
                .duration
                .map(|value| value.to_string())
                .unwrap_or_default(),
        ]
        .join("|")
    }
}

fn seconds_to_duration(seconds: f64) -> Option<Duration> {
    if !seconds.is_finite() || seconds < 0.0 {
        return None;
    }

    Some(Duration::from_secs_f64(seconds))
}

fn normalize_cover_url(cover: &str) -> Option<&str> {
    let trimmed = cover.trim();
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("file://")
    {
        return Some(trimmed);
    }

    None
}

fn resolve_cover_url(app: &AppHandle, request: &SystemMediaUpdateRequest) -> Option<String> {
    if let Some(artwork) = request.artwork.as_deref().and_then(normalize_cover_url) {
        return Some(artwork.to_string());
    }

    let track_path = request.track_path.as_deref()?.trim();
    if track_path.starts_with("http://")
        || track_path.starts_with("https://")
        || track_path.starts_with("plugin://")
    {
        return None;
    }

    crate::covers::cached_cover_thumbnail_file_url(app, track_path)
        .ok()
        .flatten()
}

fn map_media_event(event: MediaControlEvent) -> Option<SystemMediaAction> {
    let action = match event {
        MediaControlEvent::Play => SystemMediaAction::simple("play"),
        MediaControlEvent::Pause => SystemMediaAction::simple("pause"),
        MediaControlEvent::Toggle => SystemMediaAction::simple("toggle"),
        MediaControlEvent::Next => SystemMediaAction::simple("next"),
        MediaControlEvent::Previous => SystemMediaAction::simple("previous"),
        MediaControlEvent::Stop => SystemMediaAction::simple("stop"),
        MediaControlEvent::SetPosition(position) => SystemMediaAction {
            action: "seek".to_string(),
            position: Some(position.0.as_secs_f64()),
            offset: None,
        },
        MediaControlEvent::SeekBy(direction, duration) => SystemMediaAction {
            action: match direction {
                SeekDirection::Forward => "seek-forward",
                SeekDirection::Backward => "seek-backward",
            }
            .to_string(),
            position: None,
            offset: Some(duration.as_secs_f64()),
        },
        MediaControlEvent::Seek(direction) => SystemMediaAction {
            action: match direction {
                SeekDirection::Forward => "seek-forward",
                SeekDirection::Backward => "seek-backward",
            }
            .to_string(),
            position: None,
            offset: Some(10.0),
        },
        MediaControlEvent::Raise => SystemMediaAction::simple("raise"),
        MediaControlEvent::Quit => SystemMediaAction::simple("quit"),
        MediaControlEvent::SetVolume(_) | MediaControlEvent::OpenUri(_) => return None,
    };

    Some(action)
}

impl SystemMediaAction {
    fn simple(action: &str) -> Self {
        Self {
            action: action.to_string(),
            position: None,
            offset: None,
        }
    }
}

#[cfg(target_os = "windows")]
fn platform_hwnd(app: &AppHandle) -> Option<*mut std::ffi::c_void> {
    app.get_webview_window("main")
        .and_then(|window| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as *mut std::ffi::c_void)
}

#[cfg(target_os = "windows")]
fn set_platform_app_identity() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    let app_id = "com.local.mono-player\0"
        .encode_utf16()
        .collect::<Vec<u16>>();
    let result = unsafe { SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr()) };
    if result < 0 {
        eprintln!("Set AppUserModelID failed: HRESULT {result}");
    }
}

#[cfg(not(target_os = "windows"))]
fn set_platform_app_identity() {}

#[cfg(not(target_os = "windows"))]
fn platform_hwnd(_app: &AppHandle) -> Option<*mut std::ffi::c_void> {
    None
}
