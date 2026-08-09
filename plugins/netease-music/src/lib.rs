use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-netease";
const PROVIDER_NAME: &str = "网易云音乐";
const API_BASE: &str = "https://api.qijieya.cn/meting/";
const DEFAULT_QUALITY: &str = "jymaster";

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
    let request: Value = serde_json::from_slice(input).unwrap_or_else(|_| json!({}));
    let response = wrap_plugin_response(handle_request(request));
    let bytes = response.to_string().into_bytes();
    let output_len = bytes.len();
    let output = mono_alloc(output_len);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), output, output_len);
    }
    LAST_LEN.with(|value| value.set(output_len));
    output
}

fn handle_request(request: Value) -> Value {
    match request.get("action").and_then(Value::as_str) {
        Some("metadata") => metadata_response(),
        Some("search") => search_request(&request),
        Some("qualities") => qualities_response(),
        Some("play") => play_request(&request),
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
        "version": "1.0.0",
        "kind": "music",
        "author": "Mono",
        "description": "搜索并播放网易云音乐，默认使用超清母带音质。",
        "updatedAt": "2026-08-10",
        "capabilities": ["search", "play", "lyrics"],
        "highlights": ["默认 jymaster 音质", "支持搜索和歌词", "播放时按当前音质解析"],
        "permissions": ["network"]
    })
}

fn search_request(request: &Value) -> Value {
    let keyword = request.get("keyword").and_then(Value::as_str).unwrap_or("").trim();
    if keyword.is_empty() {
        return json!({ "tracks": [], "isEnd": true });
    }
    let page = request.get("page").and_then(Value::as_u64).unwrap_or(1).max(1);
    let page_size = request.get("pageSize").and_then(Value::as_u64).unwrap_or(20).clamp(1, 100);
    let offset = (page.saturating_sub(1)).saturating_mul(page_size);
    host_get(&format!(
        "{API_BASE}?type=search&s={}&limit={page_size}&offset={offset}",
        url_encode(keyword)
    ))
}

fn qualities_response() -> Value {
    json!({
        "qualities": [
            { "id": "standard", "name": "标准音质", "available": true },
            { "id": "exhigh", "name": "极高音质", "available": true },
            { "id": "lossless", "name": "无损音质", "available": true },
            { "id": "hires", "name": "Hi-Res", "available": true },
            { "id": "jyeffect", "name": "高清环绕声", "available": true },
            { "id": "sky", "name": "沉浸环绕声", "available": true },
            { "id": "jymaster", "name": "超清母带", "available": true }
        ],
        "defaultQuality": DEFAULT_QUALITY
    })
}

fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let Some(id) = track_id(track) else {
        return json!({ "error": "NetEase track missing id." });
    };
    let quality = request.get("quality").and_then(Value::as_str).unwrap_or(DEFAULT_QUALITY).trim();
    let level = if quality.is_empty() { DEFAULT_QUALITY } else { quality };
    host_get(&format!(
        "{API_BASE}?type=url&id={}&level={}",
        url_encode(&id),
        url_encode(level)
    ))
}

fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let Some(id) = track_id(track) else {
        return json!({ "error": "NetEase lyrics track missing id." });
    };
    host_get(&format!("{API_BASE}?type=lyric&id={}", url_encode(&id)))
}

fn host_response(request: &Value) -> Value {
    let original = request.get("request").unwrap_or(&Value::Null);
    let status = request.pointer("/response/status").and_then(Value::as_u64).unwrap_or(0);
    let body = request.pointer("/response/body").and_then(Value::as_str).unwrap_or("");
    if !(200..300).contains(&status) {
        return json!({ "error": format!("{} request failed: HTTP {status}", PROVIDER_NAME) });
    }
    match original.get("action").and_then(Value::as_str) {
        Some("search") => parse_search_response(original, body),
        Some("play") => parse_play_response(original, body),
        Some("lyrics") => parse_lyrics_response(body),
        action => json!({ "error": format!("unsupported host response action: {:?}", action) }),
    }
}

fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} search response is not JSON", PROVIDER_NAME) });
    };
    if !api_success(&payload) {
        return json!({ "error": api_message(&payload, "search failed") });
    }
    let songs = payload.pointer("/data/songs").and_then(Value::as_array).cloned().unwrap_or_else(|| {
        payload.get("data").and_then(Value::as_array).cloned().unwrap_or_default()
    });
    let tracks = songs.iter().filter_map(normalized_track).collect::<Vec<_>>();
    let page_size = request.get("pageSize").and_then(Value::as_u64).unwrap_or(20).clamp(1, 100) as usize;
    json!({ "tracks": tracks, "isEnd": tracks.len() < page_size })
}

fn parse_play_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} play response is not JSON", PROVIDER_NAME) });
    };
    if !api_success(&payload) {
        return json!({ "error": api_message(&payload, "play failed") });
    }
    let Some(source) = playback_item(&payload) else {
        return json!({ "error": format!("{} did not return a playable url.", PROVIDER_NAME) });
    };
    let Some(mut url) = string_field(source, &["url", "playUrl", "src"]).filter(|value| is_http_url(value)) else {
        return json!({ "error": format!("{} did not return a playable url.", PROVIDER_NAME) });
    };
    if let Some(id) = netease_outer_url_id(&url) {
        url = format!("{API_BASE}?type=url&id={}", url_encode(&id));
    }
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = string_field(source, &["level", "quality"]).unwrap_or_else(|| {
        request.get("quality").and_then(Value::as_str).unwrap_or(DEFAULT_QUALITY).to_string()
    });
    json!({
        "url": url,
        "path": url,
        "title": track.get("title").cloned().unwrap_or(Value::Null),
        "artist": track.get("artist").cloned().unwrap_or(Value::Null),
        "album": track.get("album").cloned().unwrap_or(Value::Null),
        "duration": normalize_seconds(track.get("duration")),
        "artwork": track.get("artwork").cloned().unwrap_or(Value::Null),
        "quality": quality,
        "lyrics": Value::Null,
        "sourceId": track.get("id").cloned().unwrap_or(Value::Null),
        "sourceName": PROVIDER_NAME,
        "sourceProviderId": PROVIDER_ID,
        "sourceRaw": track
    })
}

fn netease_outer_url_id(url: &str) -> Option<String> {
    if !url.contains("music.163.com/song/media/outer/url") {
        return None;
    }
    let raw_id = url.split("id=").nth(1)?.split('&').next()?.trim();
    let id = raw_id.strip_suffix(".mp3").unwrap_or(raw_id).trim();
    if id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_digit()) {
        None
    } else {
        Some(id.to_string())
    }
}

fn parse_lyrics_response(body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} lyrics response is not JSON", PROVIDER_NAME) });
    };
    if !api_success(&payload) {
        return json!({ "error": api_message(&payload, "lyrics failed") });
    }
    let data = payload.get("data").unwrap_or(&payload);
    let variants = [
        ("lrc", ["lrc", "lyric", "lyrics"]),
        ("trans", ["tlyric", "trans", "translation"]),
        ("romalrc", ["romalrc", "roma", "romaji"]),
        ("klyric", ["klyric", "krc", "yrc"]),
    ]
    .iter()
    .filter_map(|(format, keys)| lyric_content(data, keys).map(|content| json!({ "format": format, "content": content })))
    .collect::<Vec<_>>();
    if variants.is_empty() {
        return json!({ "error": "lyrics response has no lyrics" });
    }
    json!({ "defaultFormat": variants[0].get("format").and_then(Value::as_str).unwrap_or("lrc"), "lyrics": variants })
}

fn normalized_track(item: &Value) -> Option<Value> {
    let id = string_field(item, &["id", "songid"])?;
    let title = string_field(item, &["name", "title", "song"])?;
    let artist = artist_names(item);
    let album = string_field(item, &["album", "albumName"]).unwrap_or_default();
    let artwork = string_field(item, &["picUrl", "pic", "picimg", "cover", "artwork"]);
    let duration = item.get("duration").or_else(|| item.get("interval")).and_then(duration_seconds);
    Some(json!({
        "id": id,
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "artwork": artwork,
        "raw": item
    }))
}

fn playback_item(payload: &Value) -> Option<&Value> {
    payload
        .get("data")
        .and_then(|data| data.as_array().and_then(|items| items.first()).or_else(|| data.as_object().map(|_| data)))
        .or_else(|| payload.as_object().map(|_| payload))
}

fn api_success(payload: &Value) -> bool {
    matches!(payload.get("code").and_then(Value::as_i64), Some(1 | 200)) || payload.get("code").is_none()
}

fn api_message(payload: &Value, fallback: &str) -> String {
    string_field(payload, &["message", "msg", "error"]).unwrap_or_else(|| fallback.to_string())
}

fn track_id(track: &Value) -> Option<String> {
    string_field(track, &["id", "sourceId"])
        .or_else(|| track.get("raw").and_then(|raw| string_field(raw, &["id", "sourceId"])))
}

fn artist_names(item: &Value) -> Vec<String> {
    if let Some(artists) = item.get("artists") {
        if let Some(text) = artists.as_str().map(str::trim).filter(|value| !value.is_empty()) {
            return split_artist_text(text);
        }
        if let Some(items) = artists.as_array() {
            let names = items
                .iter()
                .filter_map(|artist| artist.as_str().or_else(|| artist.get("name").and_then(Value::as_str)))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            if !names.is_empty() {
                return names;
            }
        }
    }
    string_field(item, &["artist", "singer", "author"]).map_or_else(
        || vec!["Unknown Artist".to_string()],
        |artist| split_artist_text(&artist),
    )
}

fn split_artist_text(value: &str) -> Vec<String> {
    let names = value
        .split(|character| matches!(character, '/' | ',' | '&'))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if names.is_empty() {
        vec!["Unknown Artist".to_string()]
    } else {
        names
    }
}

fn lyric_content(data: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| data.get(*key))
        .and_then(|value| value.as_str().or_else(|| value.get("lyric").and_then(Value::as_str)))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn string_field(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| value.get(*key)).and_then(value_to_string)
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if !text.trim().is_empty() => Some(text.trim().to_string()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn duration_seconds(value: &Value) -> Option<u64> {
    let raw = value_to_string(value)?.parse::<f64>().ok()?;
    Some(if raw > 1000.0 { (raw / 1000.0).round() as u64 } else { raw.round() as u64 })
}

fn normalize_seconds(value: Option<&Value>) -> Value {
    value.and_then(duration_seconds).map_or(Value::Null, |seconds| json!(seconds))
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

fn host_get(url: &str) -> Value {
    json!({
        "hostRequest": {
            "method": "GET",
            "url": url,
            "headers": {
                "Accept": "application/json,text/plain,*/*",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            "data": null
        }
    })
}

fn url_encode(value: &str) -> String {
    let mut output = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => output.push(byte as char),
            b' ' => output.push_str("%20"),
            _ => output.push_str(&format!("%{byte:02X}")),
        }
    }
    output
}
