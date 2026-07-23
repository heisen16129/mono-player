#![recursion_limit = "256"]

use serde_json::{json, Value};
use std::cell::Cell;

const PLUGIN_ID: &str = "mono-wasm-theme-forest-mint";
const THEME_ID: &str = "custom:forest-mint-photo";
const NAME: &str = "森光薄荷";
const AUTHOR: &str = "Mono Player";
const UPDATED_AT: &str = "2026-07-23";
const BASE_URL: &str = "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/forest-mint/dist";

thread_local! { static LAST_LEN: Cell<usize> = const { Cell::new(0) }; }

#[no_mangle]
pub extern "C" fn mono_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub extern "C" fn mono_dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        unsafe { let _ = Vec::from_raw_parts(ptr, len, len); }
    }
}

#[no_mangle]
pub extern "C" fn mono_last_len() -> usize { LAST_LEN.with(Cell::get) }

#[no_mangle]
pub extern "C" fn mono_invoke(ptr: *const u8, len: usize) -> *mut u8 {
    let input = unsafe { std::slice::from_raw_parts(ptr, len) };
    let request: Value = serde_json::from_slice(input).unwrap_or_else(|_| json!({}));
    let response = wrap_response(handle_request(request));
    let bytes = response.to_string().into_bytes();
    let output_len = bytes.len();
    let output_ptr = mono_alloc(output_len);
    unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), output_ptr, output_len); }
    LAST_LEN.with(|value| value.set(output_len));
    output_ptr
}

fn handle_request(request: Value) -> Value {
    match request.get("action").and_then(Value::as_str) {
        Some("metadata") => metadata_response(),
        Some("theme") => theme_response(),
        action => json!({ "error": format!("unsupported action: {:?}", action) }),
    }
}

fn wrap_response(response: Value) -> Value {
    if let Some(error) = response.get("error").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()) {
        return json!({ "code": 0, "message": error, "data": null });
    }
    json!({ "code": 1, "message": "OK", "data": response })
}

fn metadata_response() -> Value {
    json!({
        "id": PLUGIN_ID,
        "name": NAME,
        "version": "1.0.0",
        "kind": "theme",
        "author": AUTHOR,
        "description": "以森林照片为背景的清透薄荷主题，适合明亮柔和的播放界面。",
        "icon": format!("{BASE_URL}/icon.svg"),
        "updatedAt": UPDATED_AT,
        "capabilities": ["theme"],
        "highlights": ["照片背景", "清透薄荷面板", "森林阳光配色"],
        "screenshots": [format!("{BASE_URL}/screenshots/1.png")],
        "permissions": []
    })
}

fn theme_response() -> Value {
    json!({
        "id": THEME_ID,
        "name": NAME,
        "author": AUTHOR,
        "variables": {
            "--smw-bg-canvas": "transparent",
            "--smw-bg-page": "rgba(249, 255, 238, 0.56)",
            "--smw-bg-sidebar": "rgba(238, 250, 229, 0.70)",
            "--smw-bg-panel": "rgba(255, 255, 248, 0.62)",
            "--smw-library-bg": "rgba(255, 255, 248, 0.58)",
            "--smw-library-border": "rgba(70, 110, 60, 0.18)",
            "--smw-bg-workspace": "rgba(248, 255, 238, 0.48)",
            "--smw-bg-input": "rgba(255, 255, 250, 0.76)",
            "--smw-bg-selected": "rgba(202, 235, 172, 0.52)",
            "--smw-bg-hover": "rgba(224, 245, 201, 0.46)",
            "--smw-border": "rgba(82, 122, 70, 0.22)",
            "--smw-border-soft": "rgba(82, 122, 70, 0.14)",
            "--smw-border-strong": "rgba(42, 86, 54, 0.54)",
            "--smw-window-border": "rgba(255, 255, 255, 0.34)",
            "--smw-player-bg": "rgba(248, 255, 238, 0.70)",
            "--smw-shell-bg": "transparent",
            "--smw-text-primary": "#153323",
            "--smw-text-body": "#244535",
            "--smw-text-secondary": "rgba(36, 69, 53, 0.72)",
            "--smw-text-muted": "rgba(62, 94, 75, 0.58)",
            "--smw-icon-muted": "rgba(39, 83, 58, 0.72)",
            "--smw-button-primary": "#4f8f48",
            "--smw-scrollbar-thumb": "rgba(79, 143, 72, 0.26)",
            "--smw-scrollbar-thumb-hover": "rgba(79, 143, 72, 0.42)",
            "--smw-accent-blue": "#92cfc4",
            "--smw-lyrics-bg": "rgba(249, 255, 238, 0.56)",
            "--smw-lyrics-glow-left": "rgba(244, 255, 210, 0.24)",
            "--smw-lyrics-glow-right": "rgba(146, 207, 196, 0.18)",
            "--smw-lyrics-current": "#356f3c",
            "--smw-volume-bg": "rgba(255, 255, 248, 0.76)",
            "--smw-volume-track": "rgba(79, 143, 72, 0.20)",
            "--smw-volume-fill": "#4f8f48",
            "--smw-volume-thumb": "#4f8f48",
            "--smw-volume-text": "rgba(36, 69, 53, 0.74)",
            "--smw-progress-track": "rgba(79, 143, 72, 0.20)",
            "--smw-progress-fill": "#92cfc4",
            "--smw-progress-thumb": "#92cfc4",
            "--smw-progress-thumb-border": "rgba(255, 255, 248, 0.86)",
            "--smw-progress-thumb-ring": "rgba(146, 207, 196, 0.28)",
            "--smw-theme-bg-size": "cover",
            "--smw-theme-bg-position": "center",
            "--smw-theme-bg-repeat": "no-repeat"
        },
        "preview": "screenshots/1.png",
        "background": "background.png",
        "backgroundOpacity": 0.72
    })
}
