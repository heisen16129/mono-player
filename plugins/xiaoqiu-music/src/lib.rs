use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-xiaoqiu";
const AQ_API_BASE: &str = "https://api.vkeys.cn/v2/music/tencent";
const LINK_API_BASE: &str = "https://api.vkeys.cn/music/tencent/song/link";
const DEFAULT_QUALITY: &str = "14";
const PROVIDER_NAME: &str = "小秋音乐";

thread_local! { static LAST_LEN: Cell<usize> = const { Cell::new(0) }; }

#[no_mangle]
pub extern "C" fn mono_alloc(len: usize) -> *mut u8 {
    let mut b = Vec::<u8>::with_capacity(len);
    let p = b.as_mut_ptr();
    std::mem::forget(b);
    p
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
    let req: Value = serde_json::from_slice(input).unwrap_or_else(|_| json!({}));
    let res = wrap_plugin_response(handle_request(req));
    let bytes = res.to_string().into_bytes();
    let out_len = bytes.len();
    let out = mono_alloc(out_len);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out, out_len);
    }
    LAST_LEN.with(|v| v.set(out_len));
    out
}

fn handle_request(request: Value) -> Value {
    match request.get("action").and_then(Value::as_str) {
        Some("metadata") => metadata_response(),
        Some("search") => search_request(&request),
        Some("play") => play_request(&request),
        Some("lyrics") => lyrics_request(&request),
        Some("qualities") => qualities_response(&request),
        Some("host_response") => host_response(&request),
        action => json!({"error":format!("unsupported action: {:?}",action)}),
    }
}

fn wrap_plugin_response(response: Value) -> Value {
    if response.get("hostRequest").is_some() {
        return response;
    }
    if let Some(error) = response.get("error").and_then(Value::as_str).map(str::trim).filter(|value| !value.is_empty()) {
        return json!({"code":0,"message":error,"data":null});
    }
    json!({"code":1,"message":"OK","data":response})
}

fn metadata_response() -> Value {
    json!({
        "id": PROVIDER_ID,
        "name": PROVIDER_NAME,
        "version": "1.0.0",
        "kind": "music",
        "author": "Mono",
        "description": "搜索并播放小秋音乐来源，支持在线播放和歌词 metadata。",
        "updatedAt": "2026-07-23",
        "capabilities": ["search", "play", "lyrics"],
        "highlights": ["支持在线搜索", "支持播放解析", "支持歌词 metadata"],
        "permissions": ["network"],
        "configSchema": {
            "fields": [{
                "key": "defaultQuality",
                "label": "\u{9ed8}\u{8ba4}\u{97f3}\u{8d28}",
                "type": "select",
                "defaultValue": DEFAULT_QUALITY,
                "options": [
                    { "label": "\u{97f3}\u{4e50}\u{8bd5}\u{542c}", "value": "0" },
                    { "label": "\u{6709}\u{635f}\u{97f3}\u{8d28}", "value": "1" },
                    { "label": "\u{6709}\u{635f}\u{97f3}\u{8d28}", "value": "2" },
                    { "label": "\u{6709}\u{635f}\u{97f3}\u{8d28}", "value": "3" },
                    { "label": "\u{6807}\u{51c6}\u{97f3}\u{8d28}", "value": "4" },
                    { "label": "\u{6807}\u{51c6}\u{97f3}\u{8d28}", "value": "5" },
                    { "label": "\u{6807}\u{51c6}\u{97f3}\u{8d28}", "value": "6" },
                    { "label": "\u{6807}\u{51c6}\u{97f3}\u{8d28}", "value": "7" },
                    { "label": "HQ\u{9ad8}\u{97f3}\u{8d28}", "value": "8" },
                    { "label": "HQ\u{9ad8}\u{97f3}\u{8d28}\u{ff08}\u{97f3}\u{8d28}\u{589e}\u{5f3a}\u{ff09}", "value": "9" },
                    { "label": "SQ\u{65e0}\u{635f}\u{97f3}\u{8d28}", "value": "10" },
                    { "label": "Hi-Res\u{97f3}\u{8d28}", "value": "11" },
                    { "label": "\u{675c}\u{6bd4}\u{5168}\u{666f}\u{58f0}", "value": "12" },
                    { "label": "\u{81fb}\u{54c1}\u{5168}\u{666f}\u{58f0}", "value": "13" },
                    { "label": "\u{81fb}\u{54c1}\u{6bcd}\u{5e26}2.0", "value": "14" }
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
        return json!({"tracks":[],"isEnd":true});
    }
    let page = request
        .get("page")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .max(1);
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(30)
        .clamp(1, 100);
    host_get(
        &format!("{AQ_API_BASE}/search/song?word={}&page={page}&num={page_size}", url_encode(keyword, false)),
        aq_headers(),
    )
}
fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = request
        .get("quality")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| configured_default_quality(request));
    let quality = normalize_quality(quality);
    let query = if let Some(mid) = source_raw_field(track, &["mid", "songmid"]) {
        format!("mid={}&quality={quality}", url_encode(&mid, false))
    } else if let Some(id) = source_raw_field(track, &["id"]) {
        format!("id={}&quality={quality}", url_encode(&id, false))
    } else {
        return json!({"error":"QQ track has no playable id or mid."});
    };
    host_get(&format!("{LINK_API_BASE}?{query}"), aq_headers())
}
fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    if let Some(raw) = pick_raw_lyrics(track) {
        return lyrics_response(Some(raw), request);
    }
    let id = source_raw_field(track, &["id"]);
    let mid = source_raw_field(track, &["mid", "songmid"]);
    let query = if let Some(id) = id {
        format!("id={}", url_encode(&id, false))
    } else if let Some(mid) = mid {
        format!("mid={}", url_encode(&mid, false))
    } else {
        return json!({"error":"QQ lyrics track missing id or mid."});
    };
    host_get(&format!("{AQ_API_BASE}/lyric?{query}"), aq_headers())
}
fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":format!("{} search response is not JSON",PROVIDER_NAME)});
    };
    if payload.get("code").and_then(Value::as_i64) != Some(200) {
        let message = payload
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("search failed");
        return json!({"error":format!("search failed: {message}")});
    }
    let songs = payload.get("data").and_then(Value::as_array).cloned().unwrap_or_default();
    let tracks = songs.iter().map(normalize_aq_search_track).collect::<Vec<_>>();
    let page_size = request.get("pageSize").and_then(Value::as_u64).unwrap_or(30).clamp(1, 100) as usize;
    json!({"tracks":tracks,"isEnd":tracks.len()<page_size})
}
fn parse_lyrics_response(_request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":format!("{} lyrics response is not JSON",PROVIDER_NAME)});
    };
    if payload.get("code").and_then(Value::as_i64) != Some(200) {
        let message = payload
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("lyrics failed");
        return json!({"error":format!("lyrics failed: {message}")});
    }
    let data = payload.get("data").unwrap_or(&Value::Null);
    let lrc = lyric_text(data, "lrc");
    let trans = lyric_text(data, "trans");
    let yrc = lyric_text(data, "yrc");
    if lrc.is_none() && trans.is_none() && yrc.is_none() {
        return json!({"error":"lyrics response has no lyrics"});
    }
    let default_format = if yrc.is_some() { "yrc" } else if lrc.is_some() { "lrc" } else { "trans" };
    let mut lyrics = Vec::new();
    if let Some(content) = lrc { lyrics.push(json!({"format":"lrc","content":content})); }
    if let Some(content) = trans { lyrics.push(json!({"format":"trans","content":content})); }
    if let Some(content) = yrc { lyrics.push(json!({"format":"yrc","content":content})); }
    json!({"defaultFormat":default_format,"lyrics":lyrics})
}
fn qualities_response(request: &Value) -> Value {
    json!({
        "qualities": [
            {"id":"0","name":"音乐试听","available":true},
            {"id":"1","name":"有损音质","available":true},
            {"id":"2","name":"有损音质","available":true},
            {"id":"3","name":"有损音质","available":true},
            {"id":"4","name":"标准音质","available":true},
            {"id":"5","name":"标准音质","available":true},
            {"id":"6","name":"标准音质","available":true},
            {"id":"7","name":"标准音质","available":true},
            {"id":"8","name":"HQ高音质","available":true},
            {"id":"9","name":"HQ高音质（音质增强）","available":true},
            {"id":"10","name":"SQ无损音质","available":true},
            {"id":"11","name":"Hi-Res音质","available":true},
            {"id":"12","name":"杜比全景声","available":true},
            {"id":"13","name":"臻品全景声","available":true},
            {"id":"14","name":"臻品母带2.0","available":true}
        ],
        "defaultQuality": configured_default_quality(request)
    })
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
    match quality.trim().parse::<u8>() {
        Ok(value) if value <= 14 => match value {
            0 => "0",
            1 => "1",
            2 => "2",
            3 => "3",
            4 => "4",
            5 => "5",
            6 => "6",
            7 => "7",
            8 => "8",
            9 => "9",
            10 => "10",
            11 => "11",
            12 => "12",
            13 => "13",
            14 => "14",
            _ => DEFAULT_QUALITY,
        },
        _ => DEFAULT_QUALITY,
    }
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
        return json!({"error":format!("{} request failed: HTTP {status}",PROVIDER_NAME)});
    }
    match original.get("action").and_then(Value::as_str) {
        Some("search") => parse_search_response(original, body),
        Some("play") => parse_play_response(original, body),
        Some("lyrics") => parse_lyrics_response(original, body),
        action => json!({"error":format!("unsupported host response action: {:?}",action)}),
    }
}

fn parse_play_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":format!("{} play response is not JSON",PROVIDER_NAME)});
    };
    let Some(url) = playable_url_from_response(&payload) else {
        return json!({"error":format!("{} did not return a playable url.",PROVIDER_NAME)});
    };
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = request
        .get("quality")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| configured_default_quality(request));
    let quality = normalize_quality(quality);
    json!({"url":url,"path":url,"title":track.get("title").cloned().unwrap_or(Value::Null),"artist":track.get("artist").cloned().unwrap_or(Value::Null),"album":track.get("album").cloned().unwrap_or(Value::Null),"duration":normalize_seconds(track.get("duration")),"artwork":track.get("artwork").cloned().unwrap_or(Value::Null),"quality":quality,"lyrics":play_lyrics_metadata(track),"sourceId":source_id_value(track),"sourceName":PROVIDER_NAME,"sourceProviderId":PROVIDER_ID,"sourceRaw":track_source_raw(track)})
}

fn source_id_value(track: &Value) -> Value { track.get("sourceId").cloned().unwrap_or(Value::Null) }
fn track_source_raw(track: &Value) -> Value { track.get("sourceRaw").cloned().unwrap_or(Value::Null) }
fn source_raw_field(track: &Value, keys: &[&str]) -> Option<String> { let source_raw = track.get("sourceRaw")?; keys.iter().find_map(|key| value_to_string(source_raw.get(*key))) }

fn normalized_track(id: String, raw: Value) -> Value {
    json!({"id":id,"providerId":PROVIDER_ID,"providerName":PROVIDER_NAME,"title":raw.get("title").and_then(Value::as_str).unwrap_or("Unknown Track"),"artist":raw.get("artist").and_then(Value::as_str).unwrap_or("Unknown Artist"),"album":raw.get("album").and_then(Value::as_str).unwrap_or(""),"duration":normalize_seconds(raw.get("duration").or_else(||raw.get("interval"))),"artwork":raw.get("artwork").cloned().unwrap_or(Value::Null),"sourceRaw":raw})
}
fn normalize_aq_search_track(item: &Value) -> Value {
    let id = value_to_string(item.get("id")).unwrap_or_else(|| {
        value_to_string(item.get("mid")).unwrap_or_default()
    });
    let mid = value_to_string(item.get("mid"));
    let duration = value_to_string(item.get("interval")).and_then(|value| parse_duration(&value));
    let raw = json!({
        "id": id,
        "songmid": mid,
        "mid": mid,
        "title": item.get("song").or_else(|| item.get("title")).cloned().unwrap_or(Value::Null),
        "artist": item.get("singer").cloned().unwrap_or(Value::String("Unknown Artist".to_string())),
        "album": item.get("album").cloned().unwrap_or(Value::Null),
        "interval": duration,
        "artwork": item.get("cover").cloned().unwrap_or(Value::Null),
        "rawLrc": item.get("lrc").cloned().unwrap_or(Value::Null),
        "lyric": item.get("lrc").cloned().unwrap_or(Value::Null),
    });
    normalized_track(id, raw)
}
fn lyrics_response(raw_lyrics: Option<String>, _request: &Value) -> Value {
    let lyrics = raw_lyrics
        .map(|content| vec![json!({"format":"lrc","content":content})])
        .unwrap_or_default();
    json!({"defaultFormat":"lrc","lyrics":lyrics})
}
fn lyric_text(data: &Value, key: &str) -> Option<String> {
    data.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
fn play_lyrics_metadata(track: &Value) -> Value {
    match pick_raw_lyrics(track) {
        Some(raw) => {
            json!({"defaultFormat":"lrc","lyrics":[{"format":"lrc","content":raw}]})
        }
        None => Value::Null,
    }
}
fn host_get(url: &str, headers: Value) -> Value {
    host_get_or_post("GET", url.to_string(), headers, None)
}
fn host_get_or_post(method: &str, url: String, headers: Value, data: Option<String>) -> Value {
    json!({"hostRequest":{"method":method,"url":url,"headers":headers,"data":data}})
}
fn headers(items: &[(&str, &str)]) -> Value {
    let mut map = serde_json::Map::new();
    for (n, v) in items {
        map.insert((*n).to_string(), Value::String((*v).to_string()));
    }
    Value::Object(map)
}
fn browser_user_agent() -> &'static str {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
fn aq_headers() -> Value {
    headers(&[
        ("Accept", "application/json,text/plain,*/*"),
        ("Accept-Language", "zh-CN,zh;q=0.9"),
        ("User-Agent", browser_user_agent()),
    ])
}
fn value_to_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(v) if !v.trim().is_empty() => Some(v.clone()),
        Value::Number(v) => Some(v.to_string()),
        _ => None,
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
fn parse_duration(value: &str) -> Option<u64> {
    let value = value.trim();
    if let Some((minutes, seconds)) = value.split_once(':') {
        let minutes = minutes.trim().parse::<u64>().ok()?;
        let seconds = seconds.trim().parse::<u64>().ok()?;
        return Some(minutes * 60 + seconds);
    }
    if let Ok(seconds) = value.parse::<f64>() {
        return Some(seconds.round() as u64);
    }
    let parts = value
        .split(|character: char| !character.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u64>().ok())
        .collect::<Vec<_>>();
    match parts.as_slice() {
        [minutes, seconds, ..] => Some(minutes * 60 + seconds),
        _ => None,
    }
}
fn pick_raw_lyrics(track: &Value) -> Option<String> {
    ["rawLrc", "rawLrcTxt", "lyric", "lyrics", "lrc"]
        .iter()
        .find_map(|k| track.get("sourceRaw").and_then(|source_raw| source_raw.get(*k)).and_then(Value::as_str).map(str::to_string))
}
fn playable_url_from_response(response: &Value) -> Option<String> {
    ["/url", "/data/url"]
        .iter()
        .filter_map(|p| response.pointer(p))
        .filter_map(Value::as_str)
        .map(str::trim)
        .find(|v| v.starts_with("http://") || v.starts_with("https://"))
        .map(str::to_string)
}
fn url_encode(value: &str, plus_space: bool) -> String {
    value
        .bytes()
        .flat_map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => vec![b as char],
            b' ' if plus_space => vec!['+'],
            b' ' => vec!['%', '2', '0'],
            _ => format!("%{b:02X}").chars().collect::<Vec<_>>(),
        })
        .collect()
}

