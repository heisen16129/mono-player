use serde_json::{json, Value};
use std::cell::Cell;

const PROVIDER_ID: &str = "mono-native-wasm-xiaogou";
const PROVIDER_NAME: &str = "小狗音乐";

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
    host_get(&format!("https://songsearch.kugou.com/song_search_v2?keyword={}&page={page}&pagesize={page_size}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1",url_encode(keyword,true)),headers(&[("Accept","*/*"),("Accept-Language","zh-CN,zh;q=0.9"),("User-Agent",browser_user_agent())]))
}
fn play_request(request: &Value) -> Value {
    let track = request.get("track").unwrap_or(&Value::Null);
    let quality = request.get("quality").and_then(Value::as_str).unwrap_or("");
    if quality.is_empty() {
        return json!({"error":"play request missing quality"});
    }
    let hash = if quality == "flac" {
        value_to_string(
            track
                .get("sqhash")
                .or_else(|| track.get("ResFileHash"))
                .or_else(|| track.get("origin_hash"))
                .or_else(|| track.get("320hash"))
                .or_else(|| track.get("id")),
        )
    } else if quality == "320k" {
        value_to_string(track.get("320hash").or_else(|| track.get("id")))
    } else {
        value_to_string(track.get("id"))
    };
    let Some(hash) = hash else {
        return json!({"error":"Kugou track has no playable hash."});
    };
    host_get(
        &format!("https://lxmusicapi.onrender.com/url/kg/{hash}/{quality}"),
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
    let Some(hash) = value_to_string(track.get("id")) else {
        return json!({"error":"Kugou lyrics track missing hash."});
    };
    let title = value_to_string(track.get("title")).unwrap_or_default();
    let duration = value_to_string(track.get("duration")).unwrap_or_else(|| "0".to_string());
    host_get(&format!("http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword={}&hash={}&timelength={}",url_encode(&title,true),url_encode(&hash,true),url_encode(&duration,true)),kugou_lyric_headers())
}
fn parse_search_response(request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":format!("{} search response is not JSON",PROVIDER_NAME)});
    };
    let songs = payload
        .pointer("/data/lists")
        .or_else(|| payload.pointer("/data/info"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let total = payload
        .pointer("/data/total")
        .and_then(Value::as_u64)
        .unwrap_or(songs.len() as u64);
    let tracks=songs.into_iter().filter_map(|item|{let hash=value_to_string(item.get("FileHash").or_else(||item.get("hash")).or_else(||item.pointer("/Grp/0/FileHash")))?; let title=value_to_string(item.get("SongName").or_else(||item.get("OriSongName")).or_else(||item.get("songname")))?; let artist=value_to_string(item.get("SingerName").or_else(||item.get("singername"))).unwrap_or_else(||"Unknown Artist".to_string()); let album=value_to_string(item.get("AlbumName").or_else(||item.get("album_name"))).unwrap_or_default(); let artwork=value_to_string(item.get("Image").or_else(||item.get("album_sizable_cover")).or_else(||item.pointer("/Grp/0/Image"))).map(|v|v.replace("{size}","1080")); let raw=json!({"id":hash,"title":title,"artist":artist,"album":album,"duration":item.get("Duration").or_else(||item.get("duration")).cloned().unwrap_or(Value::Null),"artwork":artwork,"album_id":item.get("AlbumID").or_else(||item.get("album_id")).or_else(||item.pointer("/Grp/0/AlbumID")).cloned().unwrap_or(Value::Null),"album_audio_id":item.get("album_audio_id").cloned().unwrap_or(Value::Null),"320hash":item.get("HQFileHash").or_else(||item.get("320hash")).or_else(||item.pointer("/Grp/0/HQFileHash")).cloned().unwrap_or(Value::Null),"sqhash":item.get("SQFileHash").or_else(||item.get("sqhash")).or_else(||item.pointer("/Grp/0/SQFileHash")).cloned().unwrap_or(Value::Null),"ResFileHash":item.get("ResFileHash").or_else(||item.pointer("/Grp/0/ResFileHash")).cloned().unwrap_or(Value::Null),"origin_hash":item.get("origin_hash").cloned().unwrap_or(Value::Null)}); Some(normalized_track(hash,raw))}).collect::<Vec<_>>();
    paged_tracks(request, tracks, total)
}
fn parse_lyrics_response(_request: &Value, body: &str) -> Value {
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":"Kugou lyrics search response is not JSON"});
    };
    let Some(candidate) = payload
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
    else {
        return json!({"error":"Kugou did not return lyrics candidates"});
    };
    let Some(id) = value_to_string(candidate.get("id")) else {
        return json!({"error":"Kugou lyrics candidate missing id"});
    };
    let Some(accesskey) = value_to_string(candidate.get("accesskey")) else {
        return json!({"error":"Kugou lyrics candidate missing accesskey"});
    };
    json!({"hostRequest":{"method":"GET","url":format!("http://lyrics.kugou.com/download?ver=1&client=pc&id={}&accesskey={}&fmt=lrc&charset=utf8",url_encode(&id,true),url_encode(&accesskey,true)),"headers":kugou_lyric_headers(),"data":null}})
}
fn continue_host_response(original: &Value, body: &str) -> Value {
    let parent = original.get("request").unwrap_or(&Value::Null);
    let Ok(payload) = serde_json::from_str::<Value>(body) else {
        return json!({"error":"Kugou lyrics download response is not JSON"});
    };
    let raw = payload
        .get("content")
        .and_then(Value::as_str)
        .and_then(decode_base64_utf8)
        .map(|v| decode_html_entities(&v));
    lyrics_response(raw, parent)
}
fn qualities_response() -> Value {
    json!({"qualities":[{"id":"320k","name":"高品音质","available":true}],"defaultQuality":"320k"})
}
fn kugou_lyric_headers() -> Value {
    headers(&[
        ("KG-RC", "1"),
        ("KG-THash", "expand_search_manager.cpp:852736169:451"),
        ("User-Agent", "KuGou2012-9020-ExpandSearchManager"),
    ])
}
fn decode_html_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
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
fn lyrics_response(raw_lyrics: Option<String>, _request: &Value) -> Value {
    let lyrics = raw_lyrics
        .map(|content| vec![json!({"format":"lrc","content":content})])
        .unwrap_or_default();
    json!({"defaultFormat":"lrc","lyrics":lyrics})
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

fn decode_base64_utf8(value: &str) -> Option<String> {
    let bytes = decode_base64(value)?;
    String::from_utf8(bytes).ok()
}
fn decode_base64(value: &str) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits = 0;
    for b in value.bytes().filter(|b| !b.is_ascii_whitespace()) {
        if b == b'=' {
            break;
        }
        let d = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        };
        buf = (buf << 6) | u32::from(d);
        bits += 6;
        while bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xff) as u8);
        }
    }
    Some(out)
}
