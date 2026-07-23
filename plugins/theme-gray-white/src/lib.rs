#![recursion_limit = "256"]

use serde_json::{json, Value};
use std::cell::Cell;

const PLUGIN_ID: &str = "mono-wasm-theme-gray-white";
const THEME_ID: &str = "custom:market-gray-white";
const NAME: &str = "灰白主题";
const AUTHOR: &str = "Mono Player";
const UPDATED_AT: &str = "2026-07-23";
const BASE_URL: &str = "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/master/themes/gray-white/dist";

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
        "description": "简洁的浅色灰白主题，适合日常本地音乐管理。",
        "icon": format!("{BASE_URL}/icon.svg"),
        "updatedAt": UPDATED_AT,
        "capabilities": ["theme"],
        "highlights": ["浅色界面", "低对比边框", "适合长时间使用"],
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
            "--smw-bg-canvas": "#ffffff",
            "--smw-bg-page": "#f7f7f7",
            "--smw-bg-sidebar": "#f2f2f2",
            "--smw-bg-panel": "#fafafa",
            "--smw-library-bg": "#fafafa",
            "--smw-library-border": "#d9d9d9",
            "--smw-bg-workspace": "#ffffff",
            "--smw-bg-input": "#ffffff",
            "--smw-bg-selected": "#e9e9e9",
            "--smw-bg-hover": "#eeeeee",
            "--smw-border": "#d9d9d9",
            "--smw-border-soft": "#e7e7e7",
            "--smw-border-strong": "#1f1f1f",
            "--smw-window-border": "#bdbdbd",
            "--smw-player-bg": "rgba(255, 255, 255, 0.94)",
            "--smw-shell-bg": "#ececec",
            "--smw-text-primary": "#111111",
            "--smw-text-body": "#222222",
            "--smw-text-secondary": "#777777",
            "--smw-text-muted": "#a0a0a0",
            "--smw-icon-muted": "#6f6f6f",
            "--smw-button-primary": "#2f2f2f",
            "--smw-scrollbar-thumb": "rgba(17, 17, 17, 0.18)",
            "--smw-scrollbar-thumb-hover": "rgba(17, 17, 17, 0.34)",
            "--smw-accent-blue": "#55b9ff",
            "--smw-lyrics-bg": "#ffffff",
            "--smw-lyrics-glow-left": "rgba(0, 0, 0, 0.1)",
            "--smw-lyrics-glow-right": "rgba(85, 185, 255, 0.1)",
            "--smw-lyrics-current": "#2f2f2f",
            "--smw-volume-bg": "#ffffff",
            "--smw-volume-track": "#d9d9d9",
            "--smw-volume-fill": "#2f2f2f",
            "--smw-volume-thumb": "#2f2f2f",
            "--smw-volume-text": "#777777",
            "--smw-progress-track": "#d9d9d9",
            "--smw-progress-fill": "#55b9ff",
            "--smw-progress-thumb": "#55b9ff",
            "--smw-progress-thumb-border": "#ffffff",
            "--smw-progress-thumb-ring": "rgba(85, 185, 255, 0.24)"
        },
        "preview": "screenshots/1.svg",
        "background": null,
        "backgroundOpacity": null
    })
}
