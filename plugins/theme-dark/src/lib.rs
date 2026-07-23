#![recursion_limit = "256"]

use serde_json::{json, Value};
use std::cell::Cell;

const PLUGIN_ID: &str = "mono-wasm-theme-dark";
const THEME_ID: &str = "custom:market-dark";
const NAME: &str = "深色主题";
const AUTHOR: &str = "Mono Player";
const UPDATED_AT: &str = "2026-07-23";
const BASE_URL: &str = "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/dark/dist";

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
        "description": "克制的深色主题，适合夜间播放和长时间使用。",
        "icon": format!("{BASE_URL}/icon.svg"),
        "updatedAt": UPDATED_AT,
        "capabilities": ["theme"],
        "highlights": ["深色界面", "低亮度面板", "夜间使用更舒适"],
        "screenshots": [format!("{BASE_URL}/screenshots/1.svg")],
        "permissions": []
    })
}

fn theme_response() -> Value {
    json!({
        "id": THEME_ID,
        "name": NAME,
        "author": AUTHOR,
        "variables": {
            "--smw-bg-canvas": "#101010",
            "--smw-bg-page": "#151515",
            "--smw-bg-sidebar": "#121212",
            "--smw-bg-panel": "#171717",
            "--smw-library-bg": "#171717",
            "--smw-library-border": "#2f2f2f",
            "--smw-bg-workspace": "#1e1e1e",
            "--smw-bg-input": "#222222",
            "--smw-bg-selected": "#303030",
            "--smw-bg-hover": "#2a2a2a",
            "--smw-border": "#3a3a3a",
            "--smw-border-soft": "#2f2f2f",
            "--smw-border-strong": "#555555",
            "--smw-window-border": "#333333",
            "--smw-player-bg": "rgba(18, 18, 18, 0.96)",
            "--smw-shell-bg": "#101010",
            "--smw-text-primary": "#e8e8e8",
            "--smw-text-body": "#d2d2d2",
            "--smw-text-secondary": "#a0a0a0",
            "--smw-text-muted": "#6f6f6f",
            "--smw-icon-muted": "#8a8a8a",
            "--smw-button-primary": "#8b8b8b",
            "--smw-scrollbar-thumb": "rgba(232, 232, 232, 0.2)",
            "--smw-scrollbar-thumb-hover": "rgba(232, 232, 232, 0.38)",
            "--smw-accent-blue": "#e8e8e8",
            "--smw-lyrics-bg": "#101010",
            "--smw-lyrics-glow-left": "rgba(255, 255, 255, 0.07)",
            "--smw-lyrics-glow-right": "rgba(85, 185, 255, 0.08)",
            "--smw-lyrics-current": "#f1f1f1",
            "--smw-volume-bg": "#202020",
            "--smw-volume-track": "#3a3a3a",
            "--smw-volume-fill": "#e8e8e8",
            "--smw-volume-thumb": "#e8e8e8",
            "--smw-volume-text": "#b8b8b8",
            "--smw-progress-track": "#3a3a3a",
            "--smw-progress-fill": "#e8e8e8",
            "--smw-progress-thumb": "#e8e8e8",
            "--smw-progress-thumb-border": "#202020",
            "--smw-progress-thumb-ring": "rgba(232, 232, 232, 0.24)"
        },
        "preview": "screenshots/1.svg",
        "background": null,
        "backgroundOpacity": null
    })
}
