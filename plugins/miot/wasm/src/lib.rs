use serde_json::{json, Value};
use std::cell::Cell;

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
        unsafe {
            let _ = Vec::from_raw_parts(ptr, len, len);
        }
    }
}

#[no_mangle]
pub extern "C" fn mono_last_len() -> usize {
    LAST_LEN.with(Cell::get)
}

#[no_mangle]
pub extern "C" fn mono_invoke(ptr: *const u8, len: usize) -> *mut u8 {
    let input = unsafe { std::slice::from_raw_parts(ptr, len) };
    let response = match serde_json::from_slice::<Value>(input) {
        Ok(request) => match handle_request(&request) {
            Ok(data) => json!({ "code": 1, "message": "OK", "data": data }),
            Err(message) => json!({ "code": 0, "message": message, "data": null }),
        },
        Err(error) => json!({ "code": 0, "message": error.to_string(), "data": null }),
    };
    let bytes = response.to_string().into_bytes();
    let output = mono_alloc(bytes.len());
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), output, bytes.len());
    }
    LAST_LEN.with(|length| length.set(bytes.len()));
    output
}

fn handle_request(request: &Value) -> Result<Value, String> {
    match request["action"].as_str() {
        Some("metadata") => Ok(json!({
            "id":"mono-wasm-miot", "name":"小爱音箱", "version":"1.0.0", "kind":"integration",
            "author":"Mono / hanxi", "description":"连接小爱音箱，支持扫码登录、音箱分组、语音点歌、定时播放和本地/在线音乐投放。",
            "updatedAt":"2026-09-20", "capabilities":["speaker-control"], "permissions":["network","speaker-service"],
            "highlights":["多音箱分组","语音点歌","定时与睡眠定时","本地曲库和在线音源"]
        })),
        Some("speaker_service") => Ok(json!({"engine":"mono-miot"})),
        _ => Err("不支持的插件操作".into()),
    }
}
