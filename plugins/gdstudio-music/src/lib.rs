use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-gdstudio";
const PROVIDER_NAME: &str = "GD音乐台";
const API_BASE: &str = "https://music-api.gdstudio.xyz/api.php";
const DEFAULT_SOURCE: &str = "netease";
const DEFAULT_QUALITY: &str = "320";

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
        Some("qualities") => qualities_response(&request),
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
    if let Some(error) = response
        .get("error")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
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
        "author": "GD Studio",
        "description": "基于 GD音乐台 API 的学习用途音源插件，默认使用 netease，搜索列表不预取封面。",
        "updatedAt": "2026-07-24",
        "capabilities": ["search", "play", "lyrics"],
        "highlights": ["支持 GD音乐台搜索", "搜索列表不预取封面", "支持 LRC 与翻译歌词"],
        "permissions": ["network"],
        "configSchema": {
            "fields": [{
                "key": "defaultQuality",
                "label": "\u{9ed8}\u{8ba4}\u{97f3}\u{8d28}",
                "type": "select",
                "defaultValue": DEFAULT_QUALITY,
                "options": [
                    { "label": "\u{6807}\u{51c6}\u{97f3}\u{8d28}", "value": "128" },
                    { "label": "\u{8f83}\u{9ad8}\u{97f3}\u{8d28}", "value": "192" },
                    { "label": "\u{9ad8}\u{97f3}\u{8d28}", "value": "320" },
                    { "label": "\u{65e0}\u{635f}\u{97f3}\u{8d28}", "value": "740" },
                    { "label": "\u{6700}\u{9ad8}\u{97f3}\u{8d28}", "value": "999" }
                ]
            }]
        }
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

    let source = request_source(request);
    let page = request.get("page").and_then(Value::as_u64).unwrap_or(1).max(1);
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(20)
        .clamp(1, 30);
    let url = format!(
        "{API_BASE}?types=search&source={}&name={}&count={page_size}&pages={page}",
        url_encode(&source, false),
        url_encode(keyword, false)
    );
    host_get(&url)
}

fn qualities_response(request: &Value) -> Value {
    json!({
        "qualities": [
            { "id": "128", "name": "标准音质", "available": true },
            { "id": "192", "name": "较高音质", "available": true },
            { "id": "320", "name": "高音质", "available": true },
            { "id": "740", "name": "无损音质", "available": true },
            { "id": "999", "name": "最高音质", "available": true }
        ],
        "defaultQuality": configured_default_quality(request)
    })
}

fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let Some(id) = track_id(track) else {
        return json!({ "error": "GD track missing id." });
    };
    let source = track_source(track).unwrap_or_else(|| request_source(request));
    let quality = quality_to_br(
        request
            .get("quality")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| configured_default_quality(request)),
    );
    let url = format!(
        "{API_BASE}?types=url&source={}&id={}&br={quality}",
        url_encode(&source, false),
        url_encode(&id, false)
    );
    host_get(&url)
}

fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let Some(id) = lyric_id(track).or_else(|| track_id(track)) else {
        return json!({ "error": "GD lyrics track missing lyric id." });
    };
    let source = track_source(track).unwrap_or_else(|| request_source(request));
    let url = format!(
        "{API_BASE}?types=lyric&source={}&id={}",
        url_encode(&source, false),
        url_encode(&id, false)
    );
    host_get(&url)
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
        Some("lyrics") => parse_lyrics_response(original, body),
        action => json!({ "error": format!("unsupported host response action: {:?}", action) }),
    }
}

fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} search response is not JSON", PROVIDER_NAME) });
    };
    let items = payload.as_array().cloned().unwrap_or_else(|| {
        payload
            .get("data")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
    });
    let tracks = items
        .iter()
        .filter_map(normalized_track)
        .collect::<Vec<_>>();
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(20)
        .clamp(1, 30) as usize;
    json!({ "tracks": tracks, "isEnd": tracks.len() < page_size })
}

fn parse_play_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} play response is not JSON", PROVIDER_NAME) });
    };
    let Some(url) = playable_url_from_response(&payload) else {
        return json!({ "error": format!("{} did not return a playable url.", PROVIDER_NAME) });
    };
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = payload
        .get("br")
        .and_then(|value| value_to_string(Some(value)))
        .unwrap_or_else(|| quality_to_br(configured_default_quality(request)));
    json!({
        "url": url,
        "path": url,
        "title": track.get("title").cloned().unwrap_or(Value::Null),
        "artist": track.get("artist").cloned().unwrap_or(Value::Null),
        "album": track.get("album").cloned().unwrap_or(Value::Null),
        "duration": normalize_seconds(track.get("duration")),
        "artwork": Value::Null,
        "quality": quality,
        "lyrics": Value::Null,
        "sourceId": track.get("id").cloned().unwrap_or(Value::Null),
        "sourceName": PROVIDER_NAME,
        "sourceProviderId": PROVIDER_ID,
        "sourceRaw": track
    })
}

fn parse_lyrics_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} lyrics response is not JSON", PROVIDER_NAME) });
    };
    let lyric = payload.get("lyric").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty());
    let translated = payload.get("tlyric").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty());
    let mut lyrics = Vec::new();
    if let Some(content) = lyric {
        lyrics.push(json!({ "format": "lrc", "content": content }));
    }
    if let Some(content) = translated {
        lyrics.push(json!({ "format": "trans", "content": content }));
    }
    if lyrics.is_empty() {
        return json!({ "error": "GD音乐台暂无歌词。" });
    }
    let track = request.get("track").unwrap_or(&Value::Null);
    json!({
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "trackId": lyric_id(track).or_else(|| track_id(track)),
        "defaultFormat": "lrc",
        "lyrics": lyrics
    })
}

fn normalized_track(item: &Value) -> Option<Value> {
    let id = value_to_string(item.get("id"))?;
    let title = item
        .get("name")
        .or_else(|| item.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("Unknown Track");
    let artist = normalize_artist(item.get("artist"));
    let album = item.get("album").and_then(Value::as_str).unwrap_or("");
    let source = item
        .get("source")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_SOURCE);
    let raw = json!({
        "id": id,
        "title": title,
        "artist": artist,
        "album": album,
        "source": source,
        "picId": item.get("pic_id").cloned().unwrap_or(Value::Null),
        "lyricId": item.get("lyric_id").cloned().unwrap_or(Value::Null),
        "urlId": item.get("url_id").cloned().unwrap_or(Value::Null)
    });
    Some(json!({
        "id": id,
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "title": title,
        "artist": artist,
        "album": album,
        "duration": Value::Null,
        "artwork": Value::Null,
        "raw": raw
    }))
}

fn normalize_artist(value: Option<&Value>) -> String {
    match value {
        Some(Value::Array(items)) => {
            let names = items
                .iter()
                .filter_map(|item| match item {
                    Value::String(value) => Some(value.trim()),
                    Value::Object(_) => item.get("name").and_then(Value::as_str).map(str::trim),
                    _ => None,
                })
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>();
            if names.is_empty() { "Unknown Artist".to_string() } else { names.join(", ") }
        }
        Some(Value::String(value)) if !value.trim().is_empty() => value.trim().to_string(),
        _ => "Unknown Artist".to_string(),
    }
}

fn host_get(url: &str) -> Value {
    json!({
        "hostRequest": {
            "method": "GET",
            "url": url,
            "headers": {
                "Referer": "https://music.gdstudio.xyz/",
                "User-Agent": browser_user_agent()
            },
            "data": null
        }
    })
}

fn request_source(request: &Value) -> String {
    request
        .get("source")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| is_supported_source(value))
        .unwrap_or(DEFAULT_SOURCE)
        .to_string()
}

fn track_source(track: &Value) -> Option<String> {
    ["source", "sourceId"]
        .iter()
        .find_map(|key| track.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| is_supported_source(value))
        .map(str::to_string)
}

fn is_supported_source(source: &str) -> bool {
    matches!(source, "netease" | "joox" | "bilibili")
}

fn track_id(track: &Value) -> Option<String> {
    ["id", "trackId"]
        .iter()
        .find_map(|key| value_to_string(track.get(*key)))
}

fn lyric_id(track: &Value) -> Option<String> {
    ["lyricId", "lyric_id"]
        .iter()
        .find_map(|key| value_to_string(track.get(*key)))
}

fn value_to_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) if !value.trim().is_empty() => Some(value.trim().to_string()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn quality_to_br(quality: &str) -> String {
    match normalize_quality(quality) {
        "128" | "128k" => "128".to_string(),
        "192" | "192k" => "192".to_string(),
        "320" | "320k" => "320".to_string(),
        "740" | "flac" | "lossless" => "740".to_string(),
        "999" | "hires" | "high" => "999".to_string(),
        _ => "320".to_string(),
    }
}

fn configured_default_quality(request: &Value) -> &'static str {
    let quality = request
        .get("config")
        .and_then(|config| config.get("defaultQuality"))
        .and_then(Value::as_str)
        .or_else(|| request.get("defaultQuality").and_then(Value::as_str))
        .unwrap_or(DEFAULT_QUALITY);
    normalize_quality(quality)
}

fn normalize_quality(quality: &str) -> &'static str {
    match quality.trim().to_lowercase().as_str() {
        "128" | "128k" => "128",
        "192" | "192k" => "192",
        "320" | "320k" => "320",
        "740" | "flac" | "lossless" => "740",
        "999" | "hires" | "high" => "999",
        _ => DEFAULT_QUALITY,
    }
}

fn normalize_seconds(value: Option<&Value>) -> Value {
    let Some(value) = value_to_string(value) else {
        return Value::Null;
    };
    let Ok(raw) = value.parse::<f64>() else {
        return Value::Null;
    };
    let seconds = if raw > 1000.0 { raw / 1000.0 } else { raw };
    json!(seconds.round() as u64)
}

fn playable_url_from_response(response: &Value) -> Option<String> {
    ["/url", "/data/url"]
        .iter()
        .filter_map(|path| response.pointer(path))
        .filter_map(Value::as_str)
        .map(str::trim)
        .find(|value| value.starts_with("http://") || value.starts_with("https://"))
        .map(str::to_string)
}

fn browser_user_agent() -> &'static str {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

fn url_encode(value: &str, plus_space: bool) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => vec![byte as char],
            b' ' if plus_space => vec!['+'],
            b' ' => vec!['%', '2', '0'],
            _ => format!("%{byte:02X}").chars().collect::<Vec<_>>(),
        })
        .collect()
}
