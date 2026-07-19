use crate::{
    database::{delete_missing_tracks_for_dir, read_tracks, upsert_track},
    downloads::{DownloadTrackRequest, EnqueueDownloadResult},
    models::{Track, TrackLyrics},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{hash_map::DefaultHasher, BTreeMap, HashSet},
    fs,
    hash::{Hash, Hasher},
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process, thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const MCP_SLEEP_TIMER_EVENT: &str = "mcp://sleep-timer";

const BRIDGE_FILE_NAME: &str = "mcp-bridge.json";
const BRIDGE_PATH: &str = "/mcp-bridge";
const TOKEN_HEADER: &str = "x-mono-mcp-token";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BridgeInfo {
    port: u16,
    token: String,
    pid: u32,
    started_at_ms: u128,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BridgeRequest {
    pub(crate) method: String,
    pub(crate) params: Value,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BridgeResponse {
    pub(crate) ok: bool,
    pub(crate) payload: Option<Value>,
    pub(crate) error: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpPluginManifest {
    id: String,
    name: String,
    entry: String,
    enabled: bool,
    #[serde(default)]
    capabilities: Vec<String>,
    #[serde(default)]
    permissions: Vec<String>,
}

pub(crate) fn bridge_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(BRIDGE_FILE_NAME)
}

pub(crate) fn start(app: AppHandle, app_data_dir: PathBuf) -> Result<(), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|err| err.to_string())?;
    let port = listener.local_addr().map_err(|err| err.to_string())?.port();
    let info = BridgeInfo {
        port,
        token: bridge_token(port),
        pid: process::id(),
        started_at_ms: now_ms(),
    };

    fs::create_dir_all(&app_data_dir).map_err(|err| err.to_string())?;
    fs::write(
        bridge_file_path(&app_data_dir),
        serde_json::to_string_pretty(&info).map_err(|err| err.to_string())?,
    )
    .map_err(|err| err.to_string())?;

    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else {
                continue;
            };
            let app = app.clone();
            let token = info.token.clone();
            thread::spawn(move || {
                let _ = handle_stream(stream, app, &token);
            });
        }
    });

    Ok(())
}

pub(crate) fn read_bridge_info(path: &Path) -> Result<BridgeInfo, String> {
    let content = fs::read_to_string(path).map_err(|err| {
        format!(
            "Mono Player 主进程未运行，或桥接文件不可读：{} ({err})",
            path.display()
        )
    })?;
    serde_json::from_str(&content).map_err(|err| err.to_string())
}

pub(crate) fn request(info: &BridgeInfo, request: BridgeRequest) -> Result<Value, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .post(format!("http://127.0.0.1:{}{BRIDGE_PATH}", info.port))
        .header(TOKEN_HEADER, &info.token)
        .header("content-type", "application/json")
        .body(serde_json::to_string(&request).map_err(|err| err.to_string())?)
        .send()
        .map_err(|err| format!("无法连接 Mono Player 主进程 MCP bridge：{err}"))?;

    let status = response.status();
    let body = response.text().map_err(|err| err.to_string())?;
    let bridge_response =
        serde_json::from_str::<BridgeResponse>(&body).map_err(|err| err.to_string())?;
    if !status.is_success() || !bridge_response.ok {
        return Err(bridge_response
            .error
            .unwrap_or_else(|| format!("MCP bridge HTTP {}", status.as_u16())));
    }

    Ok(bridge_response.payload.unwrap_or_else(|| json!({})))
}

fn handle_stream(mut stream: TcpStream, app: AppHandle, token: &str) -> Result<(), String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|err| err.to_string())?;
    let raw_request = read_http_request(&mut stream)?;
    let response = handle_http_request(&raw_request, app, token);
    write_http_response(&mut stream, response)
}

fn handle_http_request(raw_request: &str, app: AppHandle, token: &str) -> BridgeResponse {
    let (head, body) = match raw_request.split_once("\r\n\r\n") {
        Some(parts) => parts,
        None => return bridge_error("Invalid HTTP request"),
    };

    let mut lines = head.lines();
    let request_line = lines.next().unwrap_or_default();
    if request_line != format!("POST {BRIDGE_PATH} HTTP/1.1") {
        return bridge_error("Unsupported MCP bridge request");
    }

    let authorized = lines.any(|line| {
        line.split_once(':')
            .map(|(name, value)| {
                name.trim().eq_ignore_ascii_case(TOKEN_HEADER) && value.trim() == token
            })
            .unwrap_or(false)
    });
    if !authorized {
        return bridge_error("MCP bridge token is invalid");
    }

    match serde_json::from_str::<BridgeRequest>(body) {
        Ok(request) => handle_bridge_request(app, request),
        Err(err) => bridge_error(format!("Invalid MCP bridge JSON: {err}")),
    }
}

fn handle_bridge_request(app: AppHandle, request: BridgeRequest) -> BridgeResponse {
    let method = request.method.clone();
    log_bridge_request(&method, &request.params);
    let result = match request.method.as_str() {
        "library.summary" => library_summary(&app),
        "library.listTracks" => list_tracks(&app, request.params),
        "library.getTrack" => get_track(&app, request.params),
        "library.listArtists" => list_artists(&app),
        "library.listAlbums" => list_albums(&app),
        "playlist.list" => list_playlists(&app),
        "playlist.get" => get_playlist(&app, request.params),
        "player.state" => player_state(&app),
        "player.currentMusicState" => current_music_state(&app),
        "player.queueSnapshot" => queue_snapshot(&app),
        "player.playTrack" => play_track(&app, request.params),
        "player.pause" => control_ok(crate::player::mcp_pause(&app)),
        "player.resume" => control_ok(crate::player::mcp_resume(&app)),
        "player.stop" => control_ok(crate::player::mcp_stop(&app)),
        "player.next" => crate::player::mcp_next(&app).map(|snapshot| json!({ "queue": snapshot })),
        "player.previous" => {
            crate::player::mcp_previous(&app).map(|snapshot| json!({ "queue": snapshot }))
        }
        "player.seek" => seek(&app, request.params),
        "player.setVolume" => set_volume(&app, request.params),
        "player.setSleepTimer" => set_sleep_timer(&app, request.params),
        "scanner.scanFolder" => scan_folder(&app, request.params),
        "online.searchMusic" => search_online_music(&app, request.params),
        "online.playMusic" => play_online_music(&app, request.params),
        "online.getLyrics" => get_lyrics(&app, request.params),
        "online.getCover" => get_cover(&app, request.params),
        "online.downloadTrack" => download_track(&app, request.params),
        "resource.list" => list_resources(),
        "resource.read" => read_resource(&app, request.params),
        method => Err(format!("Unsupported MCP bridge method: {method}")),
    };

    match result {
        Ok(payload) => {
            log_bridge_result(&method, true, None);
            BridgeResponse {
                ok: true,
                payload: Some(payload),
                error: None,
            }
        }
        Err(error) => {
            log_bridge_result(&method, false, Some(&error));
            bridge_error(error)
        }
    }
}

fn log_bridge_request(method: &str, params: &Value) {
    let detail = match method {
        "library.getTrack" | "player.playTrack" => params
            .get("id")
            .map(|id| format!(" id={id}"))
            .unwrap_or_default(),
        "library.listTracks" => params
            .get("query")
            .and_then(Value::as_str)
            .map(|query| format!(" query={query:?}"))
            .unwrap_or_default(),
        "playlist.get" => params
            .get("id")
            .and_then(Value::as_str)
            .map(|id| format!(" id={id}"))
            .unwrap_or_default(),
        "online.searchMusic" => params
            .get("keyword")
            .and_then(Value::as_str)
            .map(|keyword| format!(" keyword={keyword:?}"))
            .unwrap_or_default(),
        "resource.read" => params
            .get("uri")
            .and_then(Value::as_str)
            .map(|uri| format!(" uri={uri}"))
            .unwrap_or_default(),
        _ => String::new(),
    };
    eprintln!(
        "[mcp:bridge] request method={method}{detail} params={}",
        compact_json(params)
    );
}

fn log_bridge_result(method: &str, ok: bool, error: Option<&str>) {
    match error {
        Some(error) => eprintln!("[mcp:bridge] response method={method} ok={ok} error={error}"),
        None => eprintln!("[mcp:bridge] response method={method} ok={ok}"),
    }
}

fn compact_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "<invalid-json>".to_string())
}

fn library_summary(app: &AppHandle) -> Result<Value, String> {
    let tracks = read_app_tracks(app)?;
    Ok(json!({
        "trackCount": tracks.len()
    }))
}

fn list_tracks(app: &AppHandle, params: Value) -> Result<Value, String> {
    let query = params
        .get("query")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase());
    let limit = params
        .get("limit")
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
        .unwrap_or(50)
        .clamp(1, 200);

    let tracks = read_app_tracks(app)?
        .into_iter()
        .filter(|track| {
            query
                .as_deref()
                .map(|query| track_matches_query(track, query))
                .unwrap_or(true)
        })
        .take(limit)
        .collect::<Vec<_>>();

    Ok(json!({ "tracks": tracks }))
}

fn get_track(app: &AppHandle, params: Value) -> Result<Value, String> {
    let id = params
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| "mono_get_track requires integer argument: id".to_string())?;

    read_app_tracks(app)?
        .into_iter()
        .find(|track| track.id == id)
        .map(|track| json!({ "track": track }))
        .ok_or_else(|| format!("Track not found: {id}"))
}

fn list_artists(app: &AppHandle) -> Result<Value, String> {
    let mut artists = BTreeMap::<String, usize>::new();
    for track in read_app_tracks(app)? {
        let artist = track
            .artist
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("未知艺术家")
            .to_string();
        *artists.entry(artist).or_default() += 1;
    }

    Ok(json!({
        "artists": artists
            .into_iter()
            .map(|(name, track_count)| json!({ "name": name, "trackCount": track_count }))
            .collect::<Vec<_>>()
    }))
}

fn list_albums(app: &AppHandle) -> Result<Value, String> {
    let mut albums = BTreeMap::<String, AlbumSummary>::new();
    for track in read_app_tracks(app)? {
        let album = track
            .album
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("未知专辑")
            .to_string();
        let artist = track.artist.clone();
        let summary = albums.entry(album.clone()).or_insert_with(|| AlbumSummary {
            name: album,
            artist,
            track_count: 0,
        });
        summary.track_count += 1;
        if summary.artist.is_none() {
            summary.artist = track.artist;
        }
    }

    Ok(json!({
        "albums": albums
            .into_values()
            .map(|album| {
                json!({
                    "name": album.name,
                    "artist": album.artist,
                    "trackCount": album.track_count
                })
            })
            .collect::<Vec<_>>()
    }))
}

fn list_playlists(app: &AppHandle) -> Result<Value, String> {
    let playlists = read_store_playlists(app)?;
    Ok(json!({
        "playlists": playlists
            .iter()
            .map(|playlist| {
                json!({
                    "id": playlist.get("id").and_then(Value::as_str),
                    "name": playlist.get("name").and_then(Value::as_str),
                    "trackCount": playlist
                        .get("trackIds")
                        .and_then(Value::as_array)
                        .map(Vec::len)
                        .unwrap_or(0),
                    "createdAt": playlist.get("createdAt").and_then(Value::as_f64)
                })
            })
            .collect::<Vec<_>>()
    }))
}

fn get_playlist(app: &AppHandle, params: Value) -> Result<Value, String> {
    let id = params
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "mono_get_playlist requires string argument: id".to_string())?;
    let playlists = read_store_playlists(app)?;
    let playlist = playlists
        .into_iter()
        .find(|playlist| playlist.get("id").and_then(Value::as_str) == Some(id))
        .ok_or_else(|| format!("Playlist not found: {id}"))?;

    let tracks = read_app_tracks(app)?;
    let tracks_by_id = tracks
        .into_iter()
        .map(|track| (track.id, track))
        .collect::<BTreeMap<_, _>>();
    let snapshot_by_id = playlist
        .get("tracks")
        .and_then(Value::as_array)
        .map(|tracks| {
            tracks
                .iter()
                .filter_map(|track| {
                    track
                        .get("id")
                        .and_then(Value::as_i64)
                        .map(|id| (id, track))
                })
                .collect::<BTreeMap<_, _>>()
        })
        .unwrap_or_default();
    let playlist_tracks = playlist
        .get("trackIds")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_i64)
        .filter_map(|id| {
            tracks_by_id
                .get(&id)
                .map(|track| json!(track))
                .or_else(|| snapshot_by_id.get(&id).cloned().cloned())
        })
        .collect::<Vec<_>>();

    Ok(json!({
        "playlist": {
            "id": playlist.get("id").and_then(Value::as_str),
            "name": playlist.get("name").and_then(Value::as_str),
            "createdAt": playlist.get("createdAt").and_then(Value::as_f64),
            "tracks": playlist_tracks
        }
    }))
}

fn player_state(app: &AppHandle) -> Result<Value, String> {
    crate::player::mcp_player_state(app).map(|state| json!({ "state": state }))
}

fn current_music_state(app: &AppHandle) -> Result<Value, String> {
    let state = crate::player::mcp_player_state(app)?;
    let queue = crate::player::mcp_queue_snapshot(app)?;
    let queue_value = serde_json::to_value(&queue).map_err(|err| err.to_string())?;
    let current_track = current_track_from_queue_value(&queue_value, state.current_path.as_deref());
    let duration = current_track
        .as_ref()
        .and_then(|track| track.get("duration"))
        .and_then(Value::as_f64);
    let title = current_track
        .as_ref()
        .and_then(|track| string_arg(track, "title"));
    let artist = current_track
        .as_ref()
        .and_then(|track| string_arg(track, "artist"));
    let album = current_track
        .as_ref()
        .and_then(|track| string_arg(track, "album"));
    let remaining = duration.map(|duration| (duration - state.position).max(0.0));
    let progress_percent = duration
        .filter(|duration| *duration > 0.0)
        .map(|duration| (state.position / duration * 100.0).clamp(0.0, 100.0));

    Ok(json!({
        "currentMusic": {
            "track": current_track,
            "title": title,
            "artist": artist,
            "album": album,
            "durationSeconds": duration,
            "positionSeconds": state.position,
            "remainingSeconds": remaining,
            "progressPercent": progress_percent,
            "isPlaying": state.is_playing,
            "isPaused": state.current_path.is_some() && !state.is_playing,
            "volume": state.volume,
            "speed": state.speed,
            "isBuffering": state.is_buffering,
            "sourceType": state.source_type,
            "currentPath": state.current_path,
            "queueIndex": queue_value.get("currentIndex").and_then(Value::as_u64),
            "queueLength": queue_value.get("tracks").and_then(Value::as_array).map(Vec::len).unwrap_or(0)
        }
    }))
}

fn current_track_from_queue_value(queue: &Value, current_path: Option<&str>) -> Option<Value> {
    let tracks = queue.get("tracks")?.as_array()?;
    if let Some(index) = queue
        .get("currentIndex")
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
    {
        if let Some(track) = tracks.get(index) {
            return Some(track.clone());
        }
    }

    current_path.and_then(|path| {
        tracks
            .iter()
            .find(|track| string_arg(track, "path").as_deref() == Some(path))
            .cloned()
    })
}

fn queue_snapshot(app: &AppHandle) -> Result<Value, String> {
    crate::player::mcp_queue_snapshot(app).map(|queue| json!({ "queue": queue }))
}

fn play_track(app: &AppHandle, params: Value) -> Result<Value, String> {
    let id = params
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| "mono_play_track requires integer argument: id".to_string())?;
    let track = read_app_tracks(app)?
        .into_iter()
        .find(|track| track.id == id)
        .ok_or_else(|| format!("Track not found: {id}"))?;

    let queue = crate::player::mcp_play_track(app, track.clone())?;
    Ok(json!({ "played": true, "track": track, "queue": queue }))
}

fn seek(app: &AppHandle, params: Value) -> Result<Value, String> {
    let seconds = params
        .get("seconds")
        .and_then(Value::as_f64)
        .ok_or_else(|| "mono_seek requires number argument: seconds".to_string())?;
    crate::player::mcp_seek(app, seconds)?;
    Ok(json!({ "ok": true }))
}

fn set_volume(app: &AppHandle, params: Value) -> Result<Value, String> {
    let volume = params
        .get("volume")
        .and_then(Value::as_f64)
        .ok_or_else(|| "mono_set_volume requires number argument: volume".to_string())?;
    let volume = volume.clamp(0.0, 1.0) as f32;
    crate::player::mcp_set_volume(app, volume)?;
    Ok(json!({ "ok": true, "volume": volume }))
}

fn set_sleep_timer(app: &AppHandle, params: Value) -> Result<Value, String> {
    let minutes = params
        .get("minutes")
        .and_then(Value::as_u64)
        .ok_or_else(|| "mono_set_sleep_timer requires integer argument: minutes".to_string())?
        .clamp(1, 999);
    let action = string_arg(&params, "action");
    if let Some(action) = action.as_deref() {
        if !matches!(action, "stop" | "exit" | "finishTrack") {
            return Err("action must be one of: stop, exit, finishTrack".to_string());
        }
    }

    let ends_at_ms = now_ms() + u128::from(minutes) * 60_000;
    app.emit(
        MCP_SLEEP_TIMER_EVENT,
        json!({
            "minutes": minutes,
            "action": action,
            "endsAtMs": ends_at_ms
        }),
    )
    .map_err(|err| err.to_string())?;

    Ok(json!({
        "ok": true,
        "minutes": minutes,
        "action": action,
        "endsAtMs": ends_at_ms
    }))
}

fn control_ok(result: Result<(), String>) -> Result<Value, String> {
    result.map(|()| json!({ "ok": true }))
}

fn scan_folder(app: &AppHandle, params: Value) -> Result<Value, String> {
    let path = string_arg(&params, "path")
        .ok_or_else(|| "mono_scan_folder requires string argument: path".to_string())?;
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Music directory does not exist or is not a folder.".to_string());
    }

    let mut scanned_tracks = Vec::new();
    app.state::<crate::workers::scanner::ScanWorkerState>()
        .run_scan(path.clone(), |track| {
            scanned_tracks.push(track);
            Ok(())
        })?;

    let scanned_paths = scanned_tracks
        .iter()
        .map(|track| track.path.clone())
        .collect::<HashSet<_>>();
    let state = app.state::<AppState>();
    let db = state.db.lock().map_err(|err| err.to_string())?;
    for track in &scanned_tracks {
        upsert_track(&db, track, None)?;
    }
    delete_missing_tracks_for_dir(&db, &root, &scanned_paths)?;
    let library_track_count = read_tracks(&db)?.len();

    Ok(json!({
        "ok": true,
        "path": root.to_string_lossy(),
        "scannedTrackCount": scanned_tracks.len(),
        "libraryTrackCount": library_track_count
    }))
}

fn search_online_music(app: &AppHandle, params: Value) -> Result<Value, String> {
    let keyword = string_arg(&params, "keyword")
        .ok_or_else(|| "mono_search_online_music requires string argument: keyword".to_string())?;
    let provider_id = string_arg(&params, "providerId");
    let page = params
        .get("page")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .max(1);
    let page_size = params
        .get("pageSize")
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
        .unwrap_or(30)
        .clamp(1, 100);
    let plugins = select_plugins(app, "search", provider_id.as_deref())?;

    let mut tracks = Vec::new();
    let mut is_end = true;
    let mut errors = Vec::new();
    for plugin in plugins {
        let result = invoke_plugin(
            app,
            &plugin,
            json!({
                "action": "search",
                "keyword": keyword,
                "page": page
            }),
        )
        .and_then(|response| normalize_search_page(&plugin, response));

        match result {
            Ok(page) => {
                is_end &= page.is_end || page.tracks.len() < page_size;
                tracks.extend(page.tracks);
            }
            Err(error) => errors.push(format!("{}: {error}", plugin.name)),
        }
    }

    if tracks.is_empty() && !errors.is_empty() {
        return Err(errors.join("; "));
    }

    tracks.truncate(page_size);
    Ok(json!({
        "tracks": tracks,
        "isEnd": is_end || tracks.len() < page_size,
        "errors": errors
    }))
}

fn play_online_music(app: &AppHandle, params: Value) -> Result<Value, String> {
    let track = online_track_from_params(params)?;
    let queue = crate::player::mcp_play_track(app, track.clone())?;
    Ok(json!({ "played": true, "track": track, "queue": queue }))
}

fn online_track_from_params(params: Value) -> Result<Track, String> {
    if string_arg(&params, "url").is_some() {
        return Err("online.playMusic no longer accepts direct url; pass the online track object instead.".to_string());
    }

    let track = params
        .get("track")
        .or_else(|| params.get("source"))
        .unwrap_or(&params);
    let source_provider_id = string_arg(track, "providerId")
        .or_else(|| string_arg(&params, "providerId"))
        .or_else(|| string_arg(track, "sourceProviderId"))
        .ok_or_else(|| "online.playMusic requires track.providerId".to_string())?;
    let source_id = value_to_string(track.get("id"))
        .or_else(|| string_arg(track, "sourceId"))
        .ok_or_else(|| "online.playMusic requires track.id or track.sourceId".to_string())?;
    let source_name = string_arg(track, "providerName")
        .or_else(|| string_arg(&params, "providerName"))
        .or_else(|| string_arg(track, "sourceName"));
    let title = string_arg(track, "title")
        .or_else(|| string_arg(track, "name"))
        .unwrap_or_else(|| "Online Track".to_string());
    let artist = string_arg(track, "artist").or_else(|| artist_arg(track));
    let album = string_arg(track, "album");
    let duration = number_arg(track, "duration").map(|duration| duration.max(0.0) as u64);
    let artwork = string_arg(track, "artwork");
    let raw_lyrics = string_arg(track, "rawLyrics").or_else(|| string_arg(track, "lyrics"));
    let lyrics = raw_lyrics.map(|raw_lyrics| TrackLyrics {
        raw_lyrics: Some(raw_lyrics),
        lyrics_url: None,
        formats: Vec::new(),
        default_format: None,
        format: None,
        provider_id: Some(source_provider_id.clone()),
        provider_name: source_name.clone(),
        track_id: Some(source_id.clone()),
        track_raw: track.get("raw").cloned().or_else(|| Some(track.clone())),
    });
    let path = format!("plugin://{source_provider_id}/{source_id}");

    Ok(Track {
        id: online_track_hash_id(&source_provider_id, &source_id),
        path,
        title,
        artist,
        album,
        duration,
        artwork,
        lyrics,
        source_id: Some(source_id),
        source_name,
        source_provider_id: Some(source_provider_id),
        added_at: None,
        scan_id: None,
        year: None,
        genre: None,
        track_number: None,
        associated_artwork: None,
        associated_lyrics: None,
        raw_lyrics: None,
        lyrics_source_name: None,
        lyrics_source_url: None,
        lyrics_formats: Vec::new(),
        lyrics_default_format: None,
        lyrics_format: None,
        lyrics_provider_id: None,
        lyrics_track_id: None,
        lyrics_track_raw: track.get("raw").cloned(),
        source_raw: track.get("raw").cloned().or_else(|| Some(track.clone())),
    })
}

fn online_track_hash_id(provider_id: &str, source_id: &str) -> i64 {
    let mut hasher = DefaultHasher::new();
    provider_id.hash(&mut hasher);
    source_id.hash(&mut hasher);
    -((hasher.finish() & 0x3fff_ffff_ffff_ffff) as i64)
}

fn get_lyrics(app: &AppHandle, params: Value) -> Result<Value, String> {
    if let Some(raw_lyrics) =
        string_arg(&params, "rawLyrics").or_else(|| string_arg(&params, "lyrics"))
    {
        return Ok(json!({
            "source": "provided",
            "rawLyrics": raw_lyrics
        }));
    }

    let path = track_path_from_params(app, &params)?;
    let title = string_arg(&params, "title");
    let artist = string_arg(&params, "artist");
    let lines = crate::lyrics::resolve_lyrics_source_backend(&crate::lyrics::LyricsResolveInfo {
        raw_lyrics: None,
        source_url: None,
        local_path: Some(path),
        title,
        artist,
        format: None,
    })?;
    Ok(json!({
        "source": "local",
        "lines": lines
    }))
}

fn get_cover(app: &AppHandle, params: Value) -> Result<Value, String> {
    if let Some(artwork) = string_arg(&params, "artwork") {
        validate_http_url(&artwork, "artwork")?;
        return Ok(json!({
            "source": "provided",
            "artwork": artwork
        }));
    }

    let path = track_path_from_params(app, &params)?;
    let cover = crate::covers::read_cover_backend(path)?;
    Ok(json!({
        "source": "local",
        "cover": cover
    }))
}

fn download_track(app: &AppHandle, params: Value) -> Result<Value, String> {
    let track = params
        .get("track")
        .cloned()
        .ok_or_else(|| "mono_download_track requires object argument: track".to_string())?;
    let track = serde_json::from_value::<Track>(track).map_err(|err| err.to_string())?;
    let download_dir = string_arg(&params, "downloadDir")
        .or_else(|| read_download_dir(app).ok().flatten())
        .ok_or_else(|| {
            "mono_download_track requires downloadDir, or a download directory in settings."
                .to_string()
        })?;
    let task_id = string_arg(&params, "taskId")
        .unwrap_or_else(|| format!("mcp-download-{}", now_ms()));
    let request = DownloadTrackRequest {
        task_id: Some(task_id.clone()),
        download_dir,
        track,
        quality_fallback: string_arg(&params, "qualityFallback")
            .or_else(|| string_arg(&params, "quality")),
        plugins: read_download_plugins(app)?,
    };

    let response = crate::downloads::enqueue_download_online_track(app.clone(), request);
    if response.code != 1 {
        return Err(response.message);
    }

    Ok(json!(EnqueueDownloadResult { task_id }))
}

fn read_download_plugins(
    app: &AppHandle,
) -> Result<Vec<crate::plugins::PluginPlaybackPlanPlugin>, String> {
    serde_json::from_value(
        read_store(app)?
            .get("plugins.installed")
            .cloned()
            .unwrap_or_else(|| json!([])),
    )
    .map_err(|err| err.to_string())
}

fn list_resources() -> Result<Value, String> {
    Ok(json!({
        "resources": [
            {
                "uri": "mono://library/summary",
                "name": "曲库概况",
                "description": "本地曲库曲目数量。",
                "mimeType": "application/json"
            },
            {
                "uri": "mono://library/tracks",
                "name": "曲库歌曲",
                "description": "本地曲库歌曲列表，默认最多返回 200 首。",
                "mimeType": "application/json"
            },
            {
                "uri": "mono://playlists",
                "name": "歌单列表",
                "description": "用户创建的歌单列表。",
                "mimeType": "application/json"
            },
            {
                "uri": "mono://player/state",
                "name": "播放状态",
                "description": "当前播放器状态。",
                "mimeType": "application/json"
            },
            {
                "uri": "mono://player/queue",
                "name": "播放队列",
                "description": "当前播放队列快照。",
                "mimeType": "application/json"
            }
        ]
    }))
}

fn read_resource(app: &AppHandle, params: Value) -> Result<Value, String> {
    let uri = string_arg(&params, "uri")
        .ok_or_else(|| "resources/read requires string argument: uri".to_string())?;
    let payload = match uri.as_str() {
        "mono://library/summary" => library_summary(app)?,
        "mono://library/tracks" => list_tracks(app, json!({ "limit": 200 }))?,
        "mono://playlists" => list_playlists(app)?,
        "mono://player/state" => player_state(app)?,
        "mono://player/queue" => queue_snapshot(app)?,
        _ => return Err(format!("Unknown MCP resource: {uri}")),
    };

    Ok(json!({
        "contents": [
            {
                "uri": uri,
                "mimeType": "application/json",
                "text": serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?
            }
        ]
    }))
}

fn read_app_tracks(app: &AppHandle) -> Result<Vec<Track>, String> {
    let state = app.state::<AppState>();
    let db = state.db.lock().map_err(|err| err.to_string())?;
    read_tracks(&db)
}

fn select_plugins(
    app: &AppHandle,
    capability: &str,
    provider_id: Option<&str>,
) -> Result<Vec<McpPluginManifest>, String> {
    let plugins = read_installed_plugins(app)?
        .into_iter()
        .filter(|plugin| {
            plugin.enabled
                && plugin.capabilities.iter().any(|item| item == capability)
                && provider_id
                    .map(|provider_id| plugin.id == provider_id)
                    .unwrap_or(true)
        })
        .collect::<Vec<_>>();

    if plugins.is_empty() {
        let message = match provider_id {
            Some(provider_id) => format!(
                "Selected plugin is not enabled or does not support {capability}: {provider_id}"
            ),
            None => format!("No enabled plugin supports {capability}."),
        };
        return Err(message);
    }

    Ok(plugins)
}

fn read_installed_plugins(app: &AppHandle) -> Result<Vec<McpPluginManifest>, String> {
    serde_json::from_value(
        read_store(app)?
            .get("plugins.installed")
            .cloned()
            .unwrap_or_else(|| json!([])),
    )
    .map_err(|err| err.to_string())
}

fn invoke_plugin(
    app: &AppHandle,
    plugin: &McpPluginManifest,
    request: Value,
) -> Result<Value, String> {
    let response = app
        .state::<crate::workers::plugin::PluginWorkerState>()
        .invoke_plugin(
            plugin.entry.clone(),
            request,
            Some(plugin.id.clone()),
            Some(plugin.permissions.clone()),
        )?;
    if let Some(error) = string_arg(&response, "error") {
        return Err(error);
    }
    Ok(response)
}

struct OnlineSearchPage {
    tracks: Vec<Value>,
    is_end: bool,
}

fn normalize_search_page(
    plugin: &McpPluginManifest,
    response: Value,
) -> Result<OnlineSearchPage, String> {
    let raw_tracks = response
        .get("tracks")
        .and_then(Value::as_array)
        .ok_or_else(|| "Plugin search response did not contain tracks.".to_string())?;
    let tracks = raw_tracks
        .iter()
        .cloned()
        .map(|track| normalize_search_track(plugin, track))
        .collect::<Vec<_>>();
    let is_end = response
        .get("isEnd")
        .and_then(Value::as_bool)
        .unwrap_or(tracks.is_empty());

    Ok(OnlineSearchPage { tracks, is_end })
}

fn normalize_search_track(plugin: &McpPluginManifest, raw_track: Value) -> Value {
    let mut track = match raw_track.clone() {
        Value::Object(map) => map,
        value => {
            let mut map = serde_json::Map::new();
            map.insert("raw".to_string(), value);
            map
        }
    };

    track.insert("providerId".to_string(), json!(plugin.id));
    track.insert("providerName".to_string(), json!(plugin.name));
    track
        .entry("raw".to_string())
        .or_insert_with(|| raw_track.clone());
    Value::Object(track)
}

fn read_store_playlists(app: &AppHandle) -> Result<Vec<Value>, String> {
    let store = read_store(app)?;
    Ok(store
        .get("mono-player-settings")
        .and_then(|settings| settings.get("playlists"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

fn read_download_dir(app: &AppHandle) -> Result<Option<String>, String> {
    Ok(read_store(app)?
        .get("mono-player-settings")
        .and_then(|settings| settings.get("downloadDir"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string))
}

fn read_store(app: &AppHandle) -> Result<Value, String> {
    let store_path = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join("mono-player.store.json");
    let content = fs::read_to_string(&store_path).map_err(|err| {
        format!(
            "Mono Player store 文件不可读：{} ({err})",
            store_path.display()
        )
    })?;
    serde_json::from_str::<Value>(&content).map_err(|err| err.to_string())
}

struct AlbumSummary {
    name: String,
    artist: Option<String>,
    track_count: usize,
}

fn track_path_from_params(app: &AppHandle, params: &Value) -> Result<String, String> {
    if let Some(path) = string_arg(params, "path") {
        return Ok(path);
    }

    let id = params
        .get("id")
        .and_then(Value::as_i64)
        .ok_or_else(|| "requires either path or integer argument: id".to_string())?;

    read_app_tracks(app)?
        .into_iter()
        .find(|track| track.id == id)
        .map(|track| track.path)
        .ok_or_else(|| format!("Track not found: {id}"))
}

fn string_arg(value: &Value, name: &str) -> Option<String> {
    value
        .get(name)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn number_arg(value: &Value, name: &str) -> Option<f64> {
    let value = value.get(name)?;
    value.as_f64().or_else(|| {
        value
            .as_str()
            .and_then(|value| value.trim().parse::<f64>().ok())
    })
}

fn value_to_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => {
            let value = value.trim();
            (!value.is_empty()).then(|| value.to_string())
        }
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn artist_arg(value: &Value) -> Option<String> {
    value
        .get("artists")
        .and_then(Value::as_array)
        .map(|artists| {
            artists
                .iter()
                .filter_map(|artist| {
                    artist
                        .as_str()
                        .map(str::to_string)
                        .or_else(|| string_arg(artist, "name"))
                })
                .collect::<Vec<_>>()
                .join(", ")
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn validate_http_url(url: &str, label: &str) -> Result<(), String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        Ok(())
    } else {
        Err(format!("{label} must start with http:// or https://"))
    }
}

fn track_matches_query(track: &Track, query: &str) -> bool {
    track.title.to_ascii_lowercase().contains(query)
        || track.path.to_ascii_lowercase().contains(query)
        || track
            .artist
            .as_deref()
            .map(|artist| artist.to_ascii_lowercase().contains(query))
            .unwrap_or(false)
        || track
            .album
            .as_deref()
            .map(|album| album.to_ascii_lowercase().contains(query))
            .unwrap_or(false)
}

fn read_http_request(stream: &mut TcpStream) -> Result<String, String> {
    let mut buffer = Vec::new();
    let mut chunk = [0; 1024];
    let header_end;

    loop {
        let bytes_read = stream.read(&mut chunk).map_err(|err| err.to_string())?;
        if bytes_read == 0 {
            return Err("HTTP client closed connection".to_string());
        }
        buffer.extend_from_slice(&chunk[..bytes_read]);
        if let Some(index) = find_header_end(&buffer) {
            header_end = index;
            break;
        }
    }

    let head = String::from_utf8_lossy(&buffer[..header_end]).to_string();
    let content_length = content_length(&head)?;
    let body_start = header_end + 4;
    while buffer.len().saturating_sub(body_start) < content_length {
        let bytes_read = stream.read(&mut chunk).map_err(|err| err.to_string())?;
        if bytes_read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..bytes_read]);
    }

    String::from_utf8(buffer).map_err(|err| err.to_string())
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn content_length(head: &str) -> Result<usize, String> {
    head.lines()
        .find_map(|line| {
            line.split_once(':').and_then(|(name, value)| {
                name.trim()
                    .eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>())
            })
        })
        .transpose()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "HTTP request missing content-length".to_string())
}

fn write_http_response(stream: &mut TcpStream, response: BridgeResponse) -> Result<(), String> {
    let status = if response.ok {
        "200 OK"
    } else {
        "400 Bad Request"
    };
    let body = serde_json::to_string(&response).map_err(|err| err.to_string())?;
    let head = format!(
        "HTTP/1.1 {status}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(head.as_bytes())
        .and_then(|_| stream.write_all(body.as_bytes()))
        .and_then(|_| stream.flush())
        .map_err(|err| err.to_string())
}

fn bridge_error(message: impl Into<String>) -> BridgeResponse {
    BridgeResponse {
        ok: false,
        payload: None,
        error: Some(message.into()),
    }
}

fn bridge_token(port: u16) -> String {
    format!("mono-{}-{port}-{}", process::id(), now_ms())
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}
