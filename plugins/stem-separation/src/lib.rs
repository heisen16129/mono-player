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
            "id": "mono-wasm-stem-separation",
            "name": "人声 / 伴奏分离",
            "version": "1.1.0",
            "kind": "tool",
            "author": "Mono Player",
            "description": "使用本地 Demucs 将音乐导出为人声与伴奏 WAV。支持一键准备组件、自动识别已有环境，无需手动配置。",
            "updatedAt": "2026-09-17",
            "capabilities": ["stem-separation"],
            "permissions": ["audio-process", "network"],
            "highlights": ["一键准备，自动配置", "音频在本机处理", "人声和伴奏双轨导出", "支持取消任务"],
            "configSchema": { "fields": [
                { "key": "pythonPath", "label": "自定义分离环境（可选）", "type": "text", "placeholder": "自动识别，无需填写；高级用户可指定 Python 路径" },
                { "key": "device", "label": "计算设备", "type": "select", "defaultValue": "auto", "options": [
                    { "label": "自动选择", "value": "auto" },
                    { "label": "CPU", "value": "cpu" },
                    { "label": "NVIDIA GPU", "value": "cuda" },
                    { "label": "Apple Silicon", "value": "mps" }
                ] }
            ] }
        })),
        Some("separate") => {
            let device = request["config"]["device"].as_str().unwrap_or("auto");
            if !matches!(device, "auto" | "cpu" | "cuda" | "mps") {
                return Err("不支持的计算设备".to_string());
            }
            Ok(json!({ "engine": "demucs", "model": "htdemucs_6s", "device": device }))
        }
        _ => Err("不支持的插件操作".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_a_local_separation_plan_and_rejects_unknown_devices() {
        let plan = handle_request(&json!({"action": "separate"})).unwrap();
        assert_eq!(plan["model"], "htdemucs_6s");
        assert_eq!(plan["device"], "auto");
        assert!(
            handle_request(&json!({"action": "separate", "config": {"device": "shell"}})).is_err()
        );
        assert_eq!(
            handle_request(&json!({"action": "separate", "config": {"device": "cuda"}})).unwrap()
                ["device"],
            "cuda"
        );
    }
}
