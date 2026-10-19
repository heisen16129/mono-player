#[path = "../../shared/playback_quality.rs"]
mod playback_quality;
use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-huyao-kuwo";
const PROVIDER_NAME: &str = "狐妖酷我";
const API_URL: &str = "https://api.yaohud.cn/api/music/kuwo";
const DEFAULT_QUALITY: &str = "lossless";

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
    let request = serde_json::from_slice(input).unwrap_or_else(|_| json!({}));
    let bytes = wrap_plugin_response(handle_request(request))
        .to_string()
        .into_bytes();
    let output = mono_alloc(bytes.len());
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), output, bytes.len());
    }
    LAST_LEN.with(|value| value.set(bytes.len()));
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
    if let Some(error) = response.get("error").and_then(Value::as_str) {
        return json!({ "code": 0, "message": error, "data": null });
    }
    json!({ "code": 1, "message": "OK", "data": response })
}

fn metadata_response() -> Value {
    json!({
        "id": PROVIDER_ID,
        "name": PROVIDER_NAME,
        "version": "1.0.2",
        "kind": "music",
        "author": "Mono",
        "description": "通过狐妖 API 搜索和播放酷我音乐。",
        "updatedAt": "2026-09-02",
        "capabilities": ["search", "play", "lyrics"],
        "highlights": ["支持酷我音乐搜索", "支持五档音质", "支持无损与高解析播放", "支持同步歌词"],
        "permissions": ["network"],
        "configSchema": { "fields": [
            { "key": "apiKey", "label": "接口密钥", "type": "password", "required": true, "placeholder": "在狐妖控制台的密钥管理中查看" },
            { "key": "defaultQuality", "label": "默认音质", "type": "select", "defaultValue": DEFAULT_QUALITY, "options": quality_options() }
        ] }
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
    let Some(key) = api_key(request) else {
        return json!({ "error": "请先在插件设置中填写接口密钥。" });
    };
    let page = request
        .get("page")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .max(1);
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(30)
        .max(1);
    let count = page.saturating_mul(page_size);
    host_get(api_url(&[
        ("key", key),
        ("msg", keyword.to_string()),
        ("g", count.to_string()),
    ]))
}

fn qualities_response(request: &Value) -> Value {
    json!({ "qualities": quality_options().into_iter().map(|item| json!({
        "id": item["value"], "name": item["label"], "available": true
    })).collect::<Vec<_>>(), "defaultQuality": configured_quality(request) })
}

fn play_request(request: &Value) -> Value {
    song_detail_request(request)
}

fn lyrics_request(request: &Value) -> Value {
    song_detail_request(request)
}

fn song_detail_request(request: &Value) -> Value {
    let Some(key) = api_key(request) else {
        return json!({ "error": "请先在插件设置中填写接口密钥。" });
    };
    let track = request.get("track").unwrap_or(&Value::Null);
    let Some(rid) = track_id(track) else {
        return json!({ "error": "歌曲缺少 RID，无法获取播放地址。" });
    };
    let Some(title) = track_title(track) else {
        return json!({ "error": "歌曲缺少标题，无法获取播放地址。" });
    };
    let quality = request
        .get("quality")
        .and_then(Value::as_str)
        .unwrap_or_else(|| configured_quality(request));
    host_get(api_url(&[
        ("key", key),
        ("msg", title),
        ("action", "song".to_string()),
        ("id", rid),
        ("size", normalize_quality(quality).to_string()),
    ]))
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
        return json!({ "error": format!("{PROVIDER_NAME} 请求失败：HTTP {status}") });
    }
    match original.get("action").and_then(Value::as_str) {
        Some("search") => parse_search_response(original, body),
        Some("play") => parse_play_response(original, body),
        Some("lyrics") => parse_lyrics_response(original, body),
        action => json!({ "error": format!("unsupported host response action: {:?}", action) }),
    }
}

fn parse_search_response(request: &Value, body: &str) -> Value {
    let payload: Value = match serde_json::from_str(body) {
        Ok(value) => value,
        Err(_) => return json!({ "error": "狐妖酷我搜索响应不是有效 JSON。" }),
    };
    if !api_success(&payload) {
        return api_error(&payload);
    }
    let all_tracks = payload.pointer("/data/songs").and_then(Value::as_array).into_iter().flatten().filter_map(|song| {
        let rid = value_string(song.get("rid"))?;
        let title = value_string(song.get("name"))?;
        let artist = value_string(song.get("singer")).unwrap_or_else(|| "未知歌手".to_string());
        let album = value_string(song.get("album")).unwrap_or_default();
        let artwork = value_string(song.get("image"))
            .filter(|url| url.starts_with("http://") || url.starts_with("https://"));
        Some(json!({ "id": rid, "providerId": PROVIDER_ID, "providerName": PROVIDER_NAME, "title": title, "artist": artist, "album": album, "duration": null, "artwork": artwork, "sourceRaw": song }))
    }).collect::<Vec<_>>();
    let page = request
        .get("page")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .max(1) as usize;
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(30)
        .max(1) as usize;
    let start = page.saturating_sub(1).saturating_mul(page_size);
    let tracks = all_tracks
        .into_iter()
        .skip(start)
        .take(page_size)
        .collect::<Vec<_>>();
    let is_end = tracks.len() < page_size;
    json!({ "tracks": tracks, "isEnd": is_end })
}

fn parse_play_response(request: &Value, body: &str) -> Value {
    let payload: Value = match serde_json::from_str(body) {
        Ok(value) => value,
        Err(_) => return json!({ "error": "狐妖酷我单曲响应不是有效 JSON。" }),
    };
    if !api_success(&payload) {
        return api_error(&payload);
    }
    let data = payload.get("data").unwrap_or(&Value::Null);
    let music = data.get("vipmusic").unwrap_or(&Value::Null);
    let Some(url) = value_string(music.get("url"))
        .filter(|url| url.starts_with("http://") || url.starts_with("https://"))
    else {
        return json!({ "error": "狐妖酷我未返回可播放地址。" });
    };
    let actual_quality = playback_quality::actual_quality(&payload, &url);
    let track = request.get("track").unwrap_or(&Value::Null);
    let lyrics = lyric_metadata(&payload);
    json!({
        "url": url, "path": url,
        "title": data.get("name").cloned().or_else(|| track.get("title").cloned()).unwrap_or(Value::Null),
        "artist": data.get("artist").cloned().or_else(|| data.get("songname").cloned()).or_else(|| track.get("artist").cloned()).unwrap_or(Value::Null),
        "album": data.get("album").cloned().or_else(|| track.get("album").cloned()).unwrap_or(Value::Null),
        "duration": data.get("duration").cloned().unwrap_or(Value::Null),
        "artwork": data.get("picture").cloned().unwrap_or(Value::Null),
        "quality": request.get("quality").and_then(Value::as_str).unwrap_or_else(|| configured_quality(request)),
        "actualQuality": actual_quality,
        "lyrics": lyrics,
        "sourceId": track_id(track), "sourceName": PROVIDER_NAME, "sourceProviderId": PROVIDER_ID,
        "sourceRaw": track.get("sourceRaw").cloned().unwrap_or(Value::Null)
    })
}

fn parse_lyrics_response(request: &Value, body: &str) -> Value {
    let payload: Value = match serde_json::from_str(body) {
        Ok(value) => value,
        Err(_) => return json!({ "error": "狐妖酷我歌词响应不是有效 JSON。" }),
    };
    if !api_success(&payload) {
        return api_error(&payload);
    }
    let Some(lyrics) = lyric_metadata(&payload) else {
        return json!({ "error": "狐妖酷我未返回歌词。" });
    };
    let track = request.get("track").unwrap_or(&Value::Null);
    json!({
        "providerId": PROVIDER_ID,
        "providerName": PROVIDER_NAME,
        "trackId": track_id(track),
        "defaultFormat": lyrics["defaultFormat"],
        "lyrics": lyrics["lyrics"]
    })
}

fn lyric_metadata(payload: &Value) -> Option<Value> {
    let lrc = payload
        .pointer("/data/lyric/lrc")
        .and_then(Value::as_str)?
        .trim();
    if lrc.is_empty() {
        return None;
    }
    Some(json!({
        "defaultFormat": "lrc",
        "lyrics": [{ "format": "lrc", "content": lrc }]
    }))
}

fn quality_options() -> Vec<Value> {
    vec![
        json!({ "label": "标准 128 kbps", "value": "Standard" }),
        json!({ "label": "高品质 192 kbps", "value": "exhigh" }),
        json!({ "label": "超高品质 320 kbps", "value": "SQ" }),
        json!({ "label": "无损 740 kbps", "value": "lossless" }),
        json!({ "label": "高解析 999 kbps", "value": "hires" }),
    ]
}

fn api_key(request: &Value) -> Option<String> {
    request
        .get("config")
        .and_then(|v| value_string(v.get("apiKey")))
}
fn configured_quality(request: &Value) -> &'static str {
    normalize_quality(
        request
            .get("config")
            .and_then(|v| v.get("defaultQuality"))
            .and_then(Value::as_str)
            .unwrap_or(DEFAULT_QUALITY),
    )
}
fn normalize_quality(value: &str) -> &'static str {
    match value {
        "Standard" => "Standard",
        "exhigh" => "exhigh",
        "SQ" => "SQ",
        "hires" => "hires",
        _ => DEFAULT_QUALITY,
    }
}
fn track_id(track: &Value) -> Option<String> {
    value_string(track.get("sourceId")).or_else(|| {
        track
            .get("sourceRaw")
            .and_then(|raw| value_string(raw.get("rid")))
    })
}
fn track_title(track: &Value) -> Option<String> {
    value_string(track.get("title"))
        .or_else(|| value_string(track.get("name")))
        .or_else(|| {
            track
                .get("sourceRaw")
                .and_then(|raw| value_string(raw.get("name")))
        })
}
fn api_success(payload: &Value) -> bool {
    payload.get("code").and_then(Value::as_i64) == Some(200)
}
fn api_error(payload: &Value) -> Value {
    json!({ "error": value_string(payload.get("msg")).unwrap_or_else(|| "狐妖酷我接口请求失败。".to_string()) })
}
fn value_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(v) if !v.trim().is_empty() => Some(v.clone()),
        Value::Number(v) => Some(v.to_string()),
        _ => None,
    }
}
fn host_get(url: String) -> Value {
    json!({ "hostRequest": { "method": "GET", "url": url, "headers": { "Accept": "application/json" }, "data": null } })
}
fn api_url(params: &[(&str, String)]) -> String {
    format!(
        "{API_URL}?{}",
        params
            .iter()
            .map(|(key, value)| format!("{}={}", url_encode(key), url_encode(value)))
            .collect::<Vec<_>>()
            .join("&")
    )
}
fn url_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_search_tracks() {
        let result = parse_search_response(
            &json!({ "page": 1, "pageSize": 30 }),
            r#"{"code":200,"data":{"songs":[{"name":"晴天","singer":"周杰伦","album":"叶惠美","rid":"123456","image":"http://img1.kuwo.cn/star/albumcover/120/test.jpg"}]}}"#,
        );
        assert_eq!(
            result.pointer("/tracks/0/id").and_then(Value::as_str),
            Some("123456")
        );
        assert_eq!(
            result.pointer("/tracks/0/title").and_then(Value::as_str),
            Some("晴天")
        );
        assert_eq!(
            result.pointer("/tracks/0/artwork").and_then(Value::as_str),
            Some("http://img1.kuwo.cn/star/albumcover/120/test.jpg")
        );
    }

    #[test]
    fn search_uses_cumulative_count_and_slices_current_page() {
        let request = json!({
            "action": "search",
            "keyword": "月光",
            "page": 2,
            "pageSize": 2,
            "config": { "apiKey": "test-key" }
        });
        let host_request = search_request(&request);
        let url = host_request
            .pointer("/hostRequest/url")
            .and_then(Value::as_str)
            .unwrap();
        assert!(url.contains("g=4"));

        let result = parse_search_response(
            &request,
            r#"{"code":200,"data":{"songs":[{"name":"一","singer":"歌手","rid":"1"},{"name":"二","singer":"歌手","rid":"2"},{"name":"三","singer":"歌手","rid":"3"},{"name":"四","singer":"歌手","rid":"4"}]}}"#,
        );
        assert_eq!(
            result.pointer("/tracks/0/id").and_then(Value::as_str),
            Some("3")
        );
        assert_eq!(
            result.pointer("/tracks/1/id").and_then(Value::as_str),
            Some("4")
        );
        assert_eq!(result.get("isEnd").and_then(Value::as_bool), Some(false));
    }

    #[test]
    fn parses_play_url_and_cover() {
        let request = json!({ "track": { "sourceId": "123456" }, "quality": "lossless" });
        let result = parse_play_response(
            &request,
            r#"{"code":200,"data":{"name":"晴天","artist":"周杰伦","album":"叶惠美","duration":269,"picture":"https://img.test/a.jpg","vipmusic":{"level":"lossless","url":"https://audio.test/a.flac"},"lyric":{"lrc":"[00:00.00]晴天"}}}"#,
        );
        assert_eq!(
            result.get("url").and_then(Value::as_str),
            Some("https://audio.test/a.flac")
        );
        assert_eq!(
            result.get("artwork").and_then(Value::as_str),
            Some("https://img.test/a.jpg")
        );
        assert_eq!(
            result
                .pointer("/lyrics/lyrics/0/content")
                .and_then(Value::as_str),
            Some("[00:00.00]晴天")
        );
    }

    #[test]
    fn play_request_includes_required_message() {
        let request = json!({
            "track": { "sourceId": "5961360", "title": "月光" },
            "quality": "lossless",
            "config": { "apiKey": "test-key" }
        });
        let result = play_request(&request);
        let url = result
            .pointer("/hostRequest/url")
            .and_then(Value::as_str)
            .unwrap();
        assert!(url.contains("msg=%E6%9C%88%E5%85%89"));
        assert!(url.contains("action=song"));
        assert!(url.contains("id=5961360"));
    }

    #[test]
    fn partial_page_ends_pagination() {
        let request = json!({ "page": 1, "pageSize": 30 });
        let result = parse_search_response(
            &request,
            r#"{"code":200,"data":{"songs":[{"name":"全是爱","singer":"凤凰传奇","rid":"1"}]}}"#,
        );
        assert_eq!(result.get("isEnd").and_then(Value::as_bool), Some(true));
    }

    #[test]
    fn parses_song_detail_lyrics() {
        let request = json!({ "track": { "sourceId": "118980", "title": "夜曲" } });
        let result = parse_lyrics_response(
            &request,
            r#"{"code":200,"data":{"lyric":{"lrc":"[00:00.00]夜曲 - 周杰伦\n[00:24.96]一群嗜血的蚂蚁"}}}"#,
        );
        assert_eq!(
            result.get("defaultFormat").and_then(Value::as_str),
            Some("lrc")
        );
        assert_eq!(
            result.pointer("/lyrics/0/content").and_then(Value::as_str),
            Some("[00:00.00]夜曲 - 周杰伦\n[00:24.96]一群嗜血的蚂蚁")
        );
    }
}
