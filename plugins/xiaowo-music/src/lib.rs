use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-xiaowo";
const PROVIDER_NAME: &str = "小窝音乐";

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
        Some("qualities") => qualities_response(),
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
        "version": "0.0.0",
        "kind": "music",
        "author": "Mono",
        "capabilities": ["search", "play", "lyrics"],
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
    let pn = page.saturating_sub(1);
    host_get(&format!("http://search.kuwo.cn/r.s?client=kt&all={}&pn={pn}&rn={page_size}&uid=2574109560&ver=kwplayer_ar_8.5.4.2&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1",url_encode(keyword,true)),headers(&[("Referer","http://www.kuwo.cn/"),("User-Agent",browser_user_agent())]))
}
fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = request.get("quality").and_then(Value::as_str).unwrap_or("");
    if quality.is_empty() {
        return json!({"error":"play request missing quality"});
    }
    let Some(id) = value_to_string(track.get("id")).map(|v| v.replace("MUSIC_", "")) else {
        return json!({"error":"Kuwo track has no playable id."});
    };
    host_get(
        &format!("https://lxmusicapi.onrender.com/url/kw/{id}/{quality}"),
        headers(&[
            ("X-Request-Key", "share-v3"),
            ("User-Agent", browser_user_agent()),
        ]),
    )
}
fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    if let Some(raw) = pick_raw_lyrics(track) {
        return lyrics_response(normalize_kuwo_raw_lyrics(&raw), request);
    }
    let Some(id) = value_to_string(track.get("id")).map(|v| v.replace("MUSIC_", "")) else {
        return json!({"error":"Kuwo lyrics track missing id."});
    };
    host_get(
        &format!("http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId={id}&httpStatus=1"),
        headers(&[
            ("Referer", "http://m.kuwo.cn/"),
            ("User-Agent", browser_user_agent()),
        ]),
    )
}
fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":format!("{} search response is not JSON",PROVIDER_NAME)});
    };
    let songs = payload
        .get("abslist")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let total = value_to_string(payload.get("TOTAL"))
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(songs.len() as u64);
    let tracks=songs.into_iter().map(|item|{let id=value_to_string(item.get("MUSICRID").or_else(||item.get("DC_TARGETID"))).unwrap_or_default().replace("MUSIC_",""); let title=value_to_string(item.get("NAME").or_else(||item.get("SONGNAME"))).unwrap_or_else(||"Unknown Track".to_string()); let artist=value_to_string(item.get("ARTIST")).unwrap_or_else(||"Unknown Artist".to_string()); let album=value_to_string(item.get("ALBUM")).unwrap_or_default(); let artwork=item.get("web_albumpic_short").and_then(Value::as_str).and_then(kuwo_artwork_short_to_long); let raw=json!({"id":id,"title":title,"artist":artist,"album":album,"albumId":item.get("ALBUMID").cloned().unwrap_or(Value::Null),"artistId":item.get("ARTISTID").cloned().unwrap_or(Value::Null),"duration":item.get("DURATION").cloned().unwrap_or(Value::Null),"artwork":artwork,"formats":item.get("FORMATS").cloned().unwrap_or(Value::Null)}); normalized_track(id,raw)}).collect::<Vec<_>>();
    paged_tracks(request, tracks, total)
}
fn parse_lyrics_response(request: &Value, body: &str) -> Value {
    let raw = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| format_kuwo_lyric_list(v.pointer("/data/lrclist")));
    lyrics_response(raw, request)
}
fn qualities_response() -> Value {
    json!({"qualities":[{"id":"128k","name":"标准音质","available":true},{"id":"320k","name":"高品音质","available":true},{"id":"flac","name":"无损音质","available":true}],"defaultQuality":"320k"})
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
    let quality = request.get("quality").and_then(Value::as_str).unwrap_or("");
    json!({"url":url,"path":url,"title":track.get("title").cloned().unwrap_or(Value::Null),"artist":track.get("artist").cloned().unwrap_or(Value::Null),"album":track.get("album").cloned().unwrap_or(Value::Null),"duration":normalize_seconds(track.get("duration")),"artwork":track.get("artwork").cloned().unwrap_or(Value::Null),"quality":quality,"lyrics":play_lyrics_metadata(track),"sourceId":track.get("id").cloned().unwrap_or(Value::Null),"sourceName":PROVIDER_NAME,"sourceProviderId":PROVIDER_ID,"sourceRaw":track})
}

fn normalized_track(id: String, raw: Value) -> Value {
    json!({"id":id,"providerId":PROVIDER_ID,"providerName":PROVIDER_NAME,"title":raw.get("title").and_then(Value::as_str).unwrap_or("Unknown Track"),"artist":raw.get("artist").and_then(Value::as_str).unwrap_or("Unknown Artist"),"album":raw.get("album").and_then(Value::as_str).unwrap_or(""),"duration":normalize_seconds(raw.get("duration").or_else(||raw.get("interval"))),"artwork":raw.get("artwork").cloned().unwrap_or(Value::Null),"raw":raw})
}
fn paged_tracks(request: &Value, tracks: Vec<Value>, total: u64) -> Value {
    let page = request.get("page").and_then(Value::as_u64).unwrap_or(1);
    let page_size = request
        .get("pageSize")
        .and_then(Value::as_u64)
        .unwrap_or(30)
        .clamp(1, 100);
    json!({"tracks":tracks,"isEnd":total<=page*page_size || tracks.len()<page_size as usize})
}
fn lyrics_response(raw_lyrics: Option<String>, request: &Value) -> Value {
    let format = request
        .get("format")
        .and_then(Value::as_str)
        .unwrap_or("lrc");
    json!({"rawLyrics":raw_lyrics.map(Value::String).unwrap_or(Value::Null),"formats":["lrc"],"defaultFormat":"lrc","format":format})
}
fn play_lyrics_metadata(track: &Value) -> Value {
    match pick_raw_lyrics(track) {
        Some(raw) => {
            json!({"rawLyrics":raw,"formats":["lrc"],"defaultFormat":"lrc","format":"lrc"})
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
fn pick_raw_lyrics(track: &Value) -> Option<String> {
    ["rawLrc", "rawLrcTxt", "lyric", "lyrics", "lrc"]
        .iter()
        .find_map(|k| track.get(*k).and_then(Value::as_str).map(str::to_string))
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

fn kuwo_artwork_short_to_long(value: &str) -> Option<String> {
    let i = value.find('/')?;
    Some(format!(
        "https://img4.kuwo.cn/star/albumcover/1080{}",
        &value[i..]
    ))
}
fn format_kuwo_lyric_list(value: Option<&Value>) -> Option<String> {
    let lines = value
        .and_then(Value::as_array)?
        .iter()
        .filter_map(|line| {
            let lyric = value_to_string(line.get("lineLyric")).unwrap_or_default();
            let formatted = format!("[{}]{}", format_kuwo_lyric_time(line.get("time")), lyric);
            let t = formatted.trim();
            if t.is_empty() || t.ends_with(']') {
                None
            } else {
                Some(t.to_string())
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    if lines.trim().is_empty() {
        None
    } else {
        Some(lines)
    }
}
fn normalize_kuwo_raw_lyrics(raw: &str) -> Option<String> {
    if raw.trim().is_empty() {
        return None;
    }
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(start) = rest.find('[') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let Some(end) = after.find(']') else {
            out.push_str(&rest[start..]);
            return Some(out);
        };
        let token = &after[..end];
        if token.parse::<f64>().is_ok() {
            out.push('[');
            out.push_str(&format_kuwo_lyric_time_from_str(token));
            out.push(']');
        } else {
            out.push('[');
            out.push_str(token);
            out.push(']');
        }
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    Some(out)
}
fn format_kuwo_lyric_time(v: Option<&Value>) -> String {
    let s = value_to_string(v)
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.0);
    format_kuwo_seconds(s)
}
fn format_kuwo_lyric_time_from_str(v: &str) -> String {
    format_kuwo_seconds(v.parse::<f64>().unwrap_or(0.0))
}
fn format_kuwo_seconds(total: f64) -> String {
    if !total.is_finite() || total < 0.0 {
        return "00:00.00".to_string();
    }
    let m = (total / 60.0).floor() as u64;
    let s = (total % 60.0).floor() as u64;
    let cs = ((total - total.floor()) * 100.0).floor() as u64;
    format!("{m:02}:{s:02}.{cs:02}")
}
