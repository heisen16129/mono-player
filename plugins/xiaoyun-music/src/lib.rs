use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-xiaoyun";
const PROVIDER_NAME: &str = "小芸音乐";

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
    let res = handle_request(req);
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
    let offset = page.saturating_sub(1) * page_size;
    host_get_or_post(
        "POST",
        "http://music.163.com/api/search/get/web".to_string(),
        headers(&[
            ("Content-Type", "application/x-www-form-urlencoded"),
            ("Referer", "https://music.163.com/search/"),
            ("User-Agent", browser_user_agent()),
        ]),
        Some(format!(
            "s={}&type=1&limit={page_size}&offset={offset}",
            url_encode(keyword, true)
        )),
    )
}
fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = request.get("quality").and_then(Value::as_str).unwrap_or("");
    if quality.is_empty() {
        return json!({"error":"play request missing quality"});
    }
    let Some(id) = value_to_string(track.get("id")) else {
        return json!({"error":"Netease track has no playable id."});
    };
    host_get(
        &format!("https://lxmusicapi.onrender.com/url/wy/{id}/{quality}"),
        headers(&[
            ("X-Request-Key", "share-v3"),
            ("User-Agent", browser_user_agent()),
        ]),
    )
}
fn lyrics_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    if let Some(raw) = pick_raw_lyrics(track) {
        return lyrics_response(Some(raw), request);
    }
    let Some(id) = value_to_string(track.get("id")) else {
        return json!({"error":"Netease lyrics track missing id."});
    };
    host_get(
        &format!("http://music.163.com/api/song/lyric?id={id}&lv=-1&tv=-1"),
        headers(&[
            ("Referer", "https://music.163.com/"),
            ("User-Agent", browser_user_agent()),
        ]),
    )
}
fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":format!("{} search response is not JSON",PROVIDER_NAME)});
    };
    let songs = payload
        .pointer("/result/songs")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let ids = songs
        .iter()
        .filter_map(|song| value_to_string(song.get("id")))
        .collect::<Vec<_>>();
    if !ids.is_empty() {
        return host_get(
            &format!(
                "https://music.163.com/api/song/detail?ids={}",
                url_encode(&format!("[{}]", ids.join(",")), true)
            ),
            headers(&[
                ("Referer", "https://music.163.com/"),
                ("User-Agent", browser_user_agent()),
            ]),
        );
    }
    parse_search_tracks(request, &payload, &Value::Null)
}

fn parse_search_tracks(request: &Value, payload: &Value, detail_payload: &Value) -> Value {
    let songs = payload
        .pointer("/result/songs")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let total = payload
        .pointer("/result/songCount")
        .and_then(Value::as_u64)
        .unwrap_or(songs.len() as u64);
    let artwork_by_song_id = netease_detail_artwork_map(detail_payload);
    let tracks=songs.into_iter().map(|song|{let id=value_to_string(song.get("id")).unwrap_or_default(); let album=song.get("album").cloned().unwrap_or(Value::Null); let artist=song.get("artists").and_then(Value::as_array).map(|i|join_names(i)).unwrap_or_else(||"Unknown Artist".to_string()); let artwork=album.get("picUrl").or_else(||album.get("blurPicUrl")).and_then(Value::as_str); let raw=json!({"id":song.get("id").cloned().unwrap_or(Value::Null),"title":song.get("name").cloned().unwrap_or(Value::Null),"artist":artist,"album":album.get("name").cloned().unwrap_or(Value::Null),"albumId":album.get("id").cloned().unwrap_or(Value::Null),"duration":song.get("duration").cloned().unwrap_or(Value::Null),"artwork":artwork}); normalized_track(id,raw)}).collect::<Vec<_>>();
    let tracks = tracks
        .into_iter()
        .map(|track| {
            let Some(id) = track.get("id").and_then(Value::as_str) else {
                return track;
            };
            let Some(artwork) = artwork_by_song_id.iter().find_map(|(song_id, artwork)| {
                if song_id == id {
                    Some(artwork.clone())
                } else {
                    None
                }
            }) else {
                return track;
            };
            let mut next = track;
            if let Some(raw) = next.get_mut("raw").and_then(Value::as_object_mut) {
                raw.insert("artwork".to_string(), Value::String(artwork.clone()));
            }
            if let Some(object) = next.as_object_mut() {
                object.insert("artwork".to_string(), Value::String(artwork));
            }
            next
        })
        .collect::<Vec<_>>();
    paged_tracks(request, tracks, total)
}
fn parse_lyrics_response(request: &Value, body: &str) -> Value {
    let raw = serde_json::from_str::<Value>(body).ok().and_then(|v| {
        v.pointer("/lrc/lyric")
            .and_then(Value::as_str)
            .map(str::to_string)
    });
    lyrics_response(raw, request)
}
fn qualities_response() -> Value {
    json!({"qualities":[{"id":"128k","name":"标准音质","available":true},{"id":"320k","name":"高品音质","available":true}],"defaultQuality":"320k"})
}

fn netease_detail_artwork_map(payload: &Value) -> Vec<(String, String)> {
    payload
        .get("songs")
        .and_then(Value::as_array)
        .map(|songs| {
            songs
                .iter()
                .filter_map(|song| {
                    let id = value_to_string(song.get("id"))?;
                    let album = song.get("album")?;
                    let artwork = album
                        .get("picUrl")
                        .or_else(|| album.get("blurPicUrl"))
                        .and_then(Value::as_str)?
                        .trim();
                    if artwork.is_empty() {
                        None
                    } else {
                        Some((id, artwork.to_string()))
                    }
                })
                .collect()
        })
        .unwrap_or_default()
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
        Some("host_response") => continue_host_response(original, body),
        action => json!({"error":format!("unsupported host response action: {:?}",action)}),
    }
}

fn continue_host_response(original: &Value, body: &str) -> Value {
    let parent = original.get("request").unwrap_or(&Value::Null);
    if parent.get("action").and_then(Value::as_str) != Some("search") {
        return json!({"error":"unsupported chained host response"});
    }
    let search_body = original
        .pointer("/response/body")
        .and_then(Value::as_str)
        .unwrap_or("");
    let Ok(search_payload) = serde_json::from_str::<Value>(search_body) else {
        return json!({"error":format!("{} search response is not JSON",PROVIDER_NAME)});
    };
    let detail_payload = serde_json::from_str::<Value>(body).unwrap_or(Value::Null);
    parse_search_tracks(parent, &search_payload, &detail_payload)
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

fn join_names(items: &[Value]) -> String {
    let v = items
        .iter()
        .filter_map(|i| i.get("name").and_then(Value::as_str))
        .filter(|n| !n.is_empty())
        .collect::<Vec<_>>()
        .join(", ");
    if v.is_empty() {
        "Unknown Artist".to_string()
    } else {
        v
    }
}
