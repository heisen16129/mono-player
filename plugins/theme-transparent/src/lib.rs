#![recursion_limit = "256"]

use serde_json::{json, Value};
use std::cell::Cell;

const PLUGIN_ID: &str = "mono-wasm-theme-transparent";
const THEME_ID: &str = "custom:market-transparent";
const NAME: &str = "透明主题";
const AUTHOR: &str = "Mono Player";
const UPDATED_AT: &str = "2026-07-23";
const BASE_URL: &str = "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/transparent/dist";

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
        "description": "透明玻璃风格主题，适合桌面歌词和轻量播放器界面。",
        "icon": format!("{BASE_URL}/icon.svg"),
        "updatedAt": UPDATED_AT,
        "capabilities": ["theme"],
        "highlights": ["透明面板", "玻璃质感", "适合桌面歌词"],
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
            "--smw-bg-canvas": "transparent",
            "--smw-bg-page": "rgba(255, 255, 255, 0.46)",
            "--smw-bg-sidebar": "rgba(255, 255, 255, 0.52)",
            "--smw-bg-panel": "rgba(255, 255, 255, 0.44)",
            "--smw-library-bg": "rgba(255, 255, 255, 0.44)",
            "--smw-library-border": "rgba(17, 24, 39, 0.14)",
            "--smw-bg-workspace": "rgba(255, 255, 255, 0.38)",
            "--smw-bg-input": "rgba(255, 255, 255, 0.64)",
            "--smw-bg-selected": "rgba(255, 255, 255, 0.42)",
            "--smw-bg-hover": "rgba(255, 255, 255, 0.34)",
            "--smw-border": "rgba(17, 24, 39, 0.14)",
            "--smw-border-soft": "rgba(17, 24, 39, 0.1)",
            "--smw-border-strong": "rgba(17, 24, 39, 0.48)",
            "--smw-window-border": "rgba(255, 255, 255, 0.22)",
            "--smw-player-bg": "rgba(255, 255, 255, 0.52)",
            "--smw-shell-bg": "transparent",
            "--smw-text-primary": "#111827",
            "--smw-text-body": "#1f2937",
            "--smw-text-secondary": "rgba(31, 41, 55, 0.72)",
            "--smw-text-muted": "#8a96a8",
            "--smw-icon-muted": "rgba(31, 41, 55, 0.68)",
            "--smw-button-primary": "rgba(31, 41, 55, 0.88)",
            "--smw-scrollbar-thumb": "rgba(17, 24, 39, 0.2)",
            "--smw-scrollbar-thumb-hover": "rgba(17, 24, 39, 0.34)",
            "--smw-accent-blue": "#4f9cff",
            "--smw-lyrics-bg": "rgba(255, 255, 255, 0.38)",
            "--smw-lyrics-glow-left": "rgba(255, 255, 255, 0.22)",
            "--smw-lyrics-glow-right": "rgba(79, 156, 255, 0.12)",
            "--smw-lyrics-current": "rgba(31, 41, 55, 0.88)",
            "--smw-volume-bg": "rgba(255, 255, 255, 0.68)",
            "--smw-volume-track": "rgba(17, 24, 39, 0.16)",
            "--smw-volume-fill": "#4f9cff",
            "--smw-volume-thumb": "#4f9cff",
            "--smw-volume-text": "rgba(31, 41, 55, 0.72)",
            "--smw-progress-track": "rgba(17, 24, 39, 0.16)",
            "--smw-progress-fill": "#4f9cff",
            "--smw-progress-thumb": "#4f9cff",
            "--smw-progress-thumb-border": "rgba(255, 255, 255, 0.82)",
            "--smw-progress-thumb-ring": "rgba(79, 156, 255, 0.24)"
        },
        "preview": "screenshots/1.svg",
        "background": null,
        "backgroundOpacity": null
    })
}
