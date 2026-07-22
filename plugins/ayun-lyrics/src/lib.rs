use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-wasm-ayun-lyrics";
const PROVIDER_NAME: &str = "阿云歌词";
const API_BASE: &str = "https://api.vkeys.cn/v2/music/netease";

thread_local! {
    static LAST_LEN: Cell<usize> = const { Cell::new(0) };
}

#[no_mangle]
pub extern "C" fn mono_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub extern "C" fn mono_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        let _ = Vec::from_raw_parts(ptr, len, len);
    }
}

#[no_mangle]
pub extern "C" fn mono_last_len() -> usize {
    LAST_LEN.with(Cell::get)
}

#[no_mangle]
pub extern "C" fn mono_invoke(ptr: *const u8, len: usize) -> *mut u8 {
    let input = unsafe { std::slice::from_raw_parts(ptr, len) };
    let request: Value = serde_json::from_slice(input).unwrap_or_else(|_| json!({}));
    let response = wrap_plugin_response(handle_request(request));
    let bytes = response.to_string().into_bytes();
    let output_len = bytes.len();
    let output_ptr = mono_alloc(output_len);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), output_ptr, output_len);
    }
    LAST_LEN.with(|value| value.set(output_len));
    output_ptr
}

fn handle_request(request: Value) -> Value {
    match request.get("action").and_then(Value::as_str) {
        Some("metadata") => metadata_response(),
        Some("search") => search_request(&request),
        Some("lyrics") => lyrics_request(&request),
        Some("host_response") => host_response(&request),
        action => json!({ "error": format!("unsupported action: {:?}", action) }),
    }
}

fn wrap_plugin_response(response: Value) -> Value {
    if response.get("hostRequest").is_some() {
        return response;
    }
    if let Some(error) = response.get("error").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()) {
        return json!({ "code": 0, "message": error, "data": null });
    }
    json!({ "code": 1, "message": "OK", "data": response })
}

fn metadata_response() -> Value {
    json!({
        "id": PROVIDER_ID,
        "name": PROVIDER_NAME,
        "version": "0.0.0",
        "kind": "lyrics",
        "author": "Mono",
        "capabilities": ["search", "lyrics"],
        "permissions": ["network"]
    })
}

fn search_request(request: &Value) -> Value {
    let keyword = request
        .get("keyword")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if keyword.is_empty() {
        return json!({ "tracks": [], "isEnd": true });
    }
    let page = request
        .get("page")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .max(1);
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(10)
        .clamp(1, 60);
    json!({
        "hostRequest": {
            "method": "GET",
            "url": format!("{API_BASE}?word={}&page={page}&num={page_size}", url_encode(keyword)),
            "headers": default_headers(),
            "data": null
        }
    })
}

fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let raw = track.get("raw").unwrap_or(track);
    let Some(id) = raw
        .get("id")
        .or_else(|| track.get("id"))
        .and_then(value_to_string)
    else {
        return json!({ "error": "lyrics track missing id" });
    };
    json!({
        "hostRequest": {
            "method": "GET",
            "url": format!("{API_BASE}/lyric?id={}", url_encode(&id)),
            "headers": default_headers(),
            "data": null
        }
    })
}

fn host_response(request: &Value) -> Value {
    let original = request.get("request").unwrap_or(&Value::Null);
    let status = request
        .pointer("/response/status")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let body = request
        .pointer("/response/body")
        .and_then(Value::as_str)
        .unwrap_or("");
    if !(200..300).contains(&status) {
        return json!({ "error": format!("request failed: HTTP {status}") });
    }
    match original.get("action").and_then(Value::as_str) {
        Some("search") => parse_search_response(original, body),
        Some("lyrics") => parse_lyrics_response(original, body),
        action => json!({ "error": format!("unsupported host response action: {:?}", action) }),
    }
}

fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": "search response is not JSON" });
    };
    if payload.get("code").and_then(Value::as_i64) != Some(200) {
        let message = payload
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("search failed");
        return json!({ "error": format!("search failed: {message}") });
    }
    let data = payload.get("data").unwrap_or(&Value::Null);
    let tracks = if let Some(items) = data.as_array() {
        items.iter().map(normalize_search_track).collect::<Vec<_>>()
    } else if data.is_object() {
        vec![normalize_search_track(data)]
    } else {
        Vec::new()
    };
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(10)
        .clamp(1, 60) as usize;
    json!({ "isEnd": tracks.len() < page_size, "tracks": tracks })
}

fn parse_lyrics_response(_request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": "lyrics response is not JSON" });
    };
    if payload.get("code").and_then(Value::as_i64) != Some(200) {
        let message = payload
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("lyrics failed");
        return json!({ "error": format!("lyrics failed: {message}") });
    }
    let data = payload.get("data").unwrap_or(&Value::Null);
    let lrc = lyric_text(data, "lrc");
    let trans = lyric_text(data, "trans");
    let yrc = lyric_text(data, "yrc");
    if lrc.is_none() && trans.is_none() && yrc.is_none() {
        return json!({ "error": "lyrics response has no lyrics" });
    }
    let default_format = if yrc.is_some() {
        "yrc"
    } else if lrc.is_some() {
        "lrc"
    } else {
        "trans"
    };
    let mut lyrics = Vec::new();
    if let Some(content) = lrc {
        lyrics.push(json!({"format":"lrc","content":content}));
    }
    if let Some(content) = trans {
        lyrics.push(json!({"format":"trans","content":content}));
    }
    if let Some(content) = yrc {
        lyrics.push(json!({"format":"yrc","content":content}));
    }
    json!({ "defaultFormat": default_format, "lyrics": lyrics })
}

fn normalize_search_track(item: &Value) -> Value {
    let id = item.get("id").and_then(value_to_string).unwrap_or_default();
    let title = item
        .get("song")
        .or_else(|| item.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let artist = item
        .get("singer")
        .or_else(|| item.get("artist"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let album = item.get("album").and_then(Value::as_str).unwrap_or("");
    let artwork = item.get("cover").and_then(Value::as_str);
    let duration = item
        .get("interval")
        .and_then(Value::as_str)
        .and_then(parse_duration);
    json!({
        "id": id,
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "artwork": artwork,
        "raw": item
    })
}

fn lyric_text(data: &Value, key: &str) -> Option<String> {
    data.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn parse_duration(value: &str) -> Option<u64> {
    if let Some((minutes, seconds)) = value.split_once('分') {
        let minutes = minutes.trim().parse::<u64>().ok()?;
        let seconds = seconds.trim().trim_end_matches('秒').parse::<u64>().ok()?;
        return Some(minutes * 60 + seconds);
    }
    if let Some((minutes, seconds)) = value.split_once(':') {
        let minutes = minutes.trim().parse::<u64>().ok()?;
        let seconds = seconds.trim().parse::<u64>().ok()?;
        return Some(minutes * 60 + seconds);
    }
    None
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if !text.is_empty() => Some(text.to_string()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn default_headers() -> Value {
    json!({ "Accept": "application/json,text/plain,*/*", "Accept-Language": "zh-CN,zh;q=0.9", "User-Agent": "Mozilla/5.0" })
}

fn url_encode(value: &str) -> String {
    let mut output = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                output.push(byte as char)
            }
            b' ' => output.push_str("%20"),
            _ => output.push_str(&format!("%{byte:02X}")),
        }
    }
    output
}
