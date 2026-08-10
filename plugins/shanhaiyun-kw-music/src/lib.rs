use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-shanhaiyun-kw";
const PROVIDER_NAME: &str = "山海云酷我";
const API_URL: &str = "https://apione.apibyte.cn/kwmusic";
const DEFAULT_QUALITY: &str = "p";

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
        Some("qualities") => qualities_request(&request),
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
        "version": "1.0.3",
        "kind": "music",
        "author": "Mono",
        "description": "接入山海云 APIByte 酷我音乐，支持搜索、播放地址、音质和歌词。",
        "updatedAt": "2026-08-10",
        "capabilities": ["search", "play", "lyrics"],
        "highlights": ["支持酷我音乐搜索", "支持流畅/标准/高品质/无损音质", "支持歌词获取"],
        "permissions": ["network"],
        "configSchema": {
            "fields": [
                {
                    "key": "apiKey",
                    "label": "API Key",
                    "type": "password",
                    "required": false,
                    "placeholder": "可选 API Key"
                },
                {
                    "key": "defaultQuality",
                    "label": "\u{9ed8}\u{8ba4}\u{97f3}\u{8d28}",
                    "type": "select",
                    "required": false,
                    "defaultValue": DEFAULT_QUALITY,
                    "options": [
                        { "label": "\u{6d41}\u{7545}", "value": "s" },
                        { "label": "\u{6807}\u{51c6}", "value": "h" },
                        { "label": "\u{9ad8}\u{54c1}\u{8d28}", "value": "p" },
                        { "label": "\u{65e0}\u{635f}", "value": "ff" }
                    ]
                }
            ]
        }
    })
}

fn search_request(request: &Value) -> Value {
    let keyword = request.get("keyword").and_then(Value::as_str).unwrap_or("").trim();
    if keyword.is_empty() {
        return json!({ "tracks": [], "isEnd": true });
    }
    let page = request.get("page").and_then(Value::as_u64).unwrap_or(1).max(1);
    let page_size = request.get("pageSize").and_then(Value::as_u64).unwrap_or(30).clamp(1, 100);
    host_get(&api_url(
        "search",
        &[
            ("keyword", keyword.to_string()),
            ("type", "music".to_string()),
            ("page", page.saturating_sub(1).to_string()),
            ("size", page_size.to_string()),
        ],
    ), api_key(request))
}

fn qualities_request(_request: &Value) -> Value {
    playable_qualities_response(_request)
}

fn playable_qualities_response(request: &Value) -> Value {
    json!({
        "qualities": [
            { "id": "s", "name": "\u{6d41}\u{7545}", "available": true },
            { "id": "h", "name": "\u{6807}\u{51c6}", "available": true },
            { "id": "p", "name": "\u{9ad8}\u{54c1}\u{8d28}", "available": true },
            { "id": "ff", "name": "\u{65e0}\u{635f}", "available": true }
        ],
        "defaultQuality": configured_default_quality(request)
    })
}

fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let Some(id) = track_id(track) else {
        return json!({ "error": "Kuwo track missing music_id." });
    };
    let quality = request
        .get("quality")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|quality| !quality.is_empty())
        .unwrap_or_else(|| configured_default_quality(request));
    host_get(&api_url(
        "music_url",
        &[("music_id", id), ("quality", quality.to_string())],
    ), api_key(request))
}

fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    if let Some(content) = lyric_content_deep(track) {
        return lyrics_response(content, None, track);
    }
    let Some(id) = track_id(track) else {
        return json!({ "error": "Kuwo lyrics track missing music_id." });
    };
    host_get(&api_url("lyric", &[("music_id", id)]), api_key(request))
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
        Some("qualities") => parse_qualities_response(original, body),
        Some("play") => parse_play_response(original, body),
        Some("lyrics") => parse_lyrics_response(original, body),
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
    let data = api_data(&payload);
    let items = array_items(data, &["list", "music_list", "songs", "items", "result", "results"]);
    let tracks = items.into_iter().filter_map(normalized_track).collect::<Vec<_>>();
    let page = request.get("page").and_then(Value::as_u64).unwrap_or(1).max(1);
    let page_size = request.get("pageSize").and_then(Value::as_u64).unwrap_or(30).clamp(1, 100);
    let is_end = number_field(data, &["total", "count", "TOTAL", "totalCount"])
        .map(|total| total <= page.saturating_mul(page_size))
        .unwrap_or_else(|| tracks.len() < page_size as usize);
    json!({ "tracks": tracks, "isEnd": is_end })
}

fn parse_qualities_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return static_qualities_response(request);
    };
    if !api_success(&payload) {
        return json!({ "error": api_message(&payload, "qualities failed") });
    }
    let data = api_data(&payload);
    let items = array_items(data, &["qualities", "music_qualities", "list", "items", "data"]);
    let qualities = items.into_iter().filter_map(normalized_quality).collect::<Vec<_>>();
    if qualities.is_empty() {
        static_qualities_response(request)
    } else {
        json!({ "qualities": qualities, "defaultQuality": configured_default_quality(request) })
    }
}

fn parse_play_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} play response is not JSON", PROVIDER_NAME) });
    };
    if !api_success(&payload) {
        return json!({ "error": api_message(&payload, "play failed") });
    }
    let data = api_data(&payload);
    let Some(url) = string_field(data, &["url", "play_url", "playUrl", "src", "path"])
        .or_else(|| data.as_str().map(str::to_string))
        .filter(|value| is_http_url(value)) else {
        return json!({ "error": format!("{} did not return a playable url.", PROVIDER_NAME) });
    };
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = string_field(data, &["quality", "level"]).unwrap_or_else(|| {
        configured_default_quality(request).to_string()
    });
    json!({
        "url": url,
        "path": url,
        "title": track.get("title").or_else(|| track.get("name")).cloned().unwrap_or(Value::Null),
        "artist": track.get("artist").or_else(|| track.get("singer")).cloned().unwrap_or(Value::Null),
        "album": track.get("album").or_else(|| track.get("albumName")).cloned().unwrap_or(Value::Null),
        "duration": normalize_seconds(track.get("duration")),
        "artwork": track.get("artwork").or_else(|| track.get("cover")).cloned().unwrap_or(Value::Null),
        "quality": quality,
        "lyrics": Value::Null,
        "sourceId": track_id(track).map_or(Value::Null, Value::String),
        "sourceName": PROVIDER_NAME,
        "sourceProviderId": PROVIDER_ID,
        "sourceRaw": track_source_raw(track)
    })
}

fn track_source_raw(track: &Value) -> Value {
    track.get("sourceRaw").cloned().unwrap_or(Value::Null)
}

fn parse_lyrics_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({ "error": format!("{} lyrics response is not JSON", PROVIDER_NAME) });
    };
    if !api_success(&payload) {
        return json!({ "error": api_message(&payload, "lyrics failed") });
    }
    let data = api_data(&payload);
    let Some(content) = string_field(data, &["lyric_text", "lyricText"])
        .or_else(|| lyric_content_deep(data))
        .or_else(|| lyric_content_deep(&payload)) else {
        return json!({ "error": "lyrics response has no lyrics" });
    };
    let translation = string_field(data, &["tlyric_text", "tlyricText"]);
    lyrics_response(content, translation, request.get("track").unwrap_or(&Value::Null))
}

fn normalized_track(item: &Value) -> Option<Value> {
    let id = string_field(item, &["rid", "music_id", "musicId", "id", "songid"])?;
    let title = string_field(item, &["name", "title", "song", "song_name", "songName"])?;
    let artist = artist_name(item);
    let album = string_field(item, &["album", "albumName", "album_name"]).unwrap_or_default();
    let artwork = string_field(item, &["artwork", "cover", "pic", "picUrl", "albumPic"]);
    let duration = item.get("duration").or_else(|| item.get("interval")).and_then(duration_seconds);
    let raw = json!({
        "id": id,
        "rid": item.get("rid").cloned().unwrap_or(Value::Null),
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "artwork": artwork,
        "source": item
    });
    Some(json!({
        "id": id,
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "artwork": artwork,
        "sourceRaw": raw
    }))
}

fn normalized_quality(item: &Value) -> Option<Value> {
    let id = item.as_str().map(str::to_string).or_else(|| string_field(item, &["level", "id", "quality", "type"]));
    let id = id?.trim().to_string();
    if id.is_empty() {
        return None;
    }
    let name = string_field(item, &["name"]).unwrap_or_else(|| quality_name(&id));
    let format = string_field(item, &["format"]);
    let api_available = item.get("available").and_then(Value::as_bool).unwrap_or(true);
    let supported = is_supported_playback_quality(&id, format.as_deref());
    Some(json!({
        "id": id,
        "name": name,
        "available": api_available && supported,
        "reason": if api_available && !supported { Value::String("Unsupported Kuwo private audio format".to_string()) } else { Value::Null }
    }))
}

fn is_supported_playback_quality(id: &str, format: Option<&str>) -> bool {
    let id = id.trim().to_ascii_lowercase();
    let format = format.unwrap_or("").trim().to_ascii_lowercase();
    if matches!(format.as_str(), "mflac" | "mgg" | "zp") {
        return false;
    }
    !matches!(id.as_str(), "zp" | "zpga201" | "zpga501" | "zply" | "bcms")
}

fn static_qualities_response(request: &Value) -> Value {
    json!({
        "qualities": [
            { "id": "s", "name": "流畅", "available": true },
            { "id": "h", "name": "标准", "available": true },
            { "id": "p", "name": "高品质", "available": true },
            { "id": "ff", "name": "无损", "available": true }
        ],
        "defaultQuality": configured_default_quality(request)
    })
}

fn quality_name(id: &str) -> String {
    match id {
        "s" => "流畅".to_string(),
        "h" => "标准".to_string(),
        "p" => "高品质".to_string(),
        "ff" => "无损".to_string(),
        other => other.to_string(),
    }
}

fn lyrics_response(content: String, translation: Option<String>, track: &Value) -> Value {
    let mut lyrics = vec![json!({ "format": "lrc", "content": content })];
    if let Some(translation) = translation.filter(|value| !value.trim().is_empty()) {
        lyrics.push(json!({ "format": "trans", "content": translation }));
    }
    json!({
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "trackId": track_id(track),
        "defaultFormat": "lrc",
        "lyrics": lyrics
    })
}

fn host_get(url: &str, key: Option<String>) -> Value {
    json!({
        "hostRequest": {
            "method": "GET",
            "url": url,
            "headers": request_headers(key),
            "data": null
        }
    })
}

fn request_headers(key: Option<String>) -> Value {
    let mut headers = serde_json::Map::new();
    headers.insert("Accept".to_string(), Value::String("application/json,text/plain,*/*".to_string()));
    headers.insert("User-Agent".to_string(), Value::String("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string()));
    if let Some(key) = key.filter(|value| !value.trim().is_empty()) {
        headers.insert("X-Api-Key".to_string(), Value::String(key));
    }
    Value::Object(headers)
}

fn api_url(action: &str, params: &[(&str, String)]) -> String {
    let mut parts = vec![format!("action={}", url_encode(action))];
    for (name, value) in params {
        parts.push(format!("{}={}", url_encode(name), url_encode(value)));
    }
    format!("{API_URL}?{}", parts.join("&"))
}

fn api_key(request: &Value) -> Option<String> {
    request
        .get("config")
        .and_then(|config| string_field(config, &["apiKey", "api_key", "key"]))
        .or_else(|| string_field(request, &["apiKey", "api_key", "key"]))
}

fn configured_default_quality(request: &Value) -> &'static str {
    let quality = request
        .get("config")
        .and_then(|config| string_field(config, &["defaultQuality", "default_quality"]))
        .or_else(|| string_field(request, &["defaultQuality", "default_quality"]))
        .unwrap_or_else(|| DEFAULT_QUALITY.to_string());
    normalize_playable_quality(&quality)
}

fn normalize_playable_quality(quality: &str) -> &'static str {
    match quality.trim() {
        "s" => "s",
        "h" => "h",
        "p" => "p",
        "ff" => "ff",
        _ => DEFAULT_QUALITY,
    }
}

fn api_data(payload: &Value) -> &Value {
    payload.get("data").unwrap_or(payload)
}

fn api_success(payload: &Value) -> bool {
    matches!(payload.get("code").and_then(Value::as_i64), Some(1 | 200))
        || matches!(payload.get("success").and_then(Value::as_bool), Some(true))
        || (payload.get("code").is_none() && payload.get("success").is_none())
}

fn api_message(payload: &Value, fallback: &str) -> String {
    string_field(payload, &["message", "msg", "error"]).unwrap_or_else(|| fallback.to_string())
}

fn array_items<'a>(value: &'a Value, keys: &[&str]) -> Vec<&'a Value> {
    if let Some(items) = value.as_array() {
        return items.iter().collect();
    }
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_array))
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn track_id(track: &Value) -> Option<String> {
    string_field(track, &["sourceId"])
        .or_else(|| track.get("sourceRaw").and_then(|source_raw| string_field(source_raw, &["id", "rid", "music_id", "musicId", "sourceId"])))
        .or_else(|| track.get("sourceRaw").and_then(|source_raw| source_raw.get("source")).and_then(|source| string_field(source, &["id", "rid", "music_id", "musicId", "sourceId"])))
}

fn artist_name(item: &Value) -> String {
    if let Some(artist) = string_field(item, &["artist", "singer", "author", "artistName"]) {
        return artist;
    }
    if let Some(items) = item.get("artists").and_then(Value::as_array) {
        let names = items.iter().filter_map(|artist| {
            artist.as_str().map(str::to_string).or_else(|| string_field(artist, &["name"]))
        }).collect::<Vec<_>>();
        if !names.is_empty() {
            return names.join(", ");
        }
    }
    "Unknown Artist".to_string()
}

fn lyric_content(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|value| value.as_str().or_else(|| value.get("lyric").and_then(Value::as_str)))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn lyric_content_deep(value: &Value) -> Option<String> {
    lyric_content_deep_with_depth(value, 0)
}

fn lyric_content_deep_with_depth(value: &Value, depth: usize) -> Option<String> {
    if depth > 4 {
        return None;
    }
    if let Some(text) = value.as_str().map(str::trim).filter(|text| !text.is_empty()) {
        return Some(text.to_string());
    }
    if let Some(content) = lyric_content(value, &["rawLrc", "rawLrcTxt", "lyric_text", "lyricText", "lyric", "lyrics", "lrc", "content", "text"]) {
        return Some(content);
    }
    if let Some(content) = lyric_array_content(value.as_array()) {
        return Some(content);
    }
    ["data", "result", "list", "lines", "lrclist", "lyric", "lyric_list", "music_lyric"]
        .iter()
        .find_map(|key| value.get(*key).and_then(|next| lyric_content_deep_with_depth(next, depth + 1)))
}

fn lyric_array_content(value: Option<&Vec<Value>>) -> Option<String> {
    let lines = value?
        .iter()
        .filter_map(|line| {
            if let Some(text) = line.as_str().map(str::trim).filter(|text| !text.is_empty()) {
                return Some(text.to_string());
            }
            let text = string_field(line, &["lineLyric", "lyric", "text", "content", "words"])?;
            if text.trim().is_empty() {
                return None;
            }
            let time = line
                .get("time")
                .or_else(|| line.get("start"))
                .or_else(|| line.get("timestamp"))
                .and_then(lyric_time_tag)
                .unwrap_or_default();
            Some(format!("{time}{text}"))
        })
        .collect::<Vec<_>>()
        .join("\n");
    if lines.trim().is_empty() {
        None
    } else {
        Some(lines)
    }
}

fn lyric_time_tag(value: &Value) -> Option<String> {
    let seconds = match value {
        Value::Number(number) => number.as_f64()?,
        Value::String(text) => text.trim().parse::<f64>().ok()?,
        _ => return None,
    };
    let seconds = if seconds > 1000.0 { seconds / 1000.0 } else { seconds };
    if !seconds.is_finite() || seconds < 0.0 {
        return None;
    }
    let minutes = (seconds / 60.0).floor() as u64;
    let whole_seconds = (seconds % 60.0).floor() as u64;
    let centiseconds = ((seconds - seconds.floor()) * 100.0).round() as u64;
    Some(format!("[{minutes:02}:{whole_seconds:02}.{centiseconds:02}]"))
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

fn number_field(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| value.get(*key)).and_then(|value| value_to_string(value)?.parse::<u64>().ok())
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
