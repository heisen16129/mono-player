use crate::api_response::ApiResponse;
use crate::models::TrackLyrics;
use rodio::cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

mod cache;
mod queue;

use cache::*;
pub(crate) use cache::{mono_cache_dir, online_audio_cache_dir};
use queue::*;

pub(crate) struct PlayerState {
    inner: Arc<Mutex<PlayerBackend>>,
    cache_dir: Arc<Mutex<PathBuf>>,
    default_cache_dir: PathBuf,
}

impl PlayerState {
    pub(crate) fn new(cache_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&cache_dir);
        cleanup_online_audio_cache_files(&cache_dir, None);
        let default_cache_dir = cache_dir.clone();

        let state = Self {
            inner: Arc::new(Mutex::new(PlayerBackend::default())),
            cache_dir: Arc::new(Mutex::new(cache_dir)),
            default_cache_dir,
        };
        start_daily_cache_cleanup(Arc::clone(&state.cache_dir));
        state
    }

    pub(crate) fn cache_dir(&self) -> Result<PathBuf, String> {
        self.cache_dir
            .lock()
            .map(|path| path.clone())
            .map_err(|err| err.to_string())
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlayerSnapshot {
    pub(crate) current_path: Option<String>,
    pub(crate) position: f64,
    pub(crate) is_playing: bool,
    pub(crate) duration: Option<f64>,
    pub(crate) volume: f32,
    pub(crate) speed: f32,
    pub(crate) spectrum_levels: Vec<f32>,
    pub(crate) source_type: Option<String>,
    pub(crate) active_cache_path: Option<String>,
    pub(crate) is_buffering: bool,
    pub(crate) is_crossfading: bool,
    pub(crate) last_error: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AudioOutputDevice {
    id: String,
    name: String,
    is_default: bool,
}

pub(crate) struct McpOnlineTrackMetadata {
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) duration: Option<f64>,
    pub(crate) artwork: Option<String>,
    pub(crate) lyrics: Option<TrackLyrics>,
    pub(crate) source_id: Option<String>,
    pub(crate) source_name: Option<String>,
    pub(crate) source_provider_id: Option<String>,
}

#[tauri::command]
pub(crate) fn player_system_temp_cache_dir() -> ApiResponse<String> {
    ApiResponse::success(system_temp_cache_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub(crate) fn player_default_cache_dir(state: State<'_, PlayerState>) -> ApiResponse<String> {
    ApiResponse::success(state.default_cache_dir.to_string_lossy().to_string())
}

fn normalize_cache_dir_path(path: &str) -> String {
    let trimmed = path.trim();
    if let Some(rest) = trimmed.strip_prefix("file:///") {
        #[cfg(target_os = "windows")]
        {
            return rest.replace('/', "\\");
        }
        #[cfg(not(target_os = "windows"))]
        {
            return format!("/{rest}");
        }
    }
    trimmed.to_string()
}

fn next_playback_generation(backend: &mut PlayerBackend) -> u64 {
    backend.playback_generation = backend.playback_generation.wrapping_add(1);
    backend.playback_generation
}

fn current_playback_generation(state: &Arc<Mutex<PlayerBackend>>) -> Result<u64, String> {
    let backend = state.lock().map_err(|err| err.to_string())?;
    Ok(backend.playback_generation)
}

fn queue_track_plugin_value(track: &QueueTrack) -> Value {
    json!({
        "id": track.source_id.as_deref().unwrap_or(""),
        "providerId": track.source_provider_id.as_deref().unwrap_or(""),
        "providerName": track.source_name.as_deref().unwrap_or(""),
        "title": track.title,
        "artist": track.artist.as_deref().unwrap_or(""),
        "album": track.album.as_deref().unwrap_or(""),
        "duration": track.duration,
        "artwork": track.artwork,
    })
}

fn read_installed_playback_plugins(
    app: &AppHandle,
) -> Result<Vec<crate::plugins::PluginPlaybackPlanPlugin>, String> {
    let value = crate::store::read_value(app, "plugins.installed")
        .map_err(|err| err.to_string())?
        .unwrap_or_else(|| Value::Array(Vec::new()));
    serde_json::from_value(value).map_err(|err| err.to_string())
}

fn read_quality_fallback(app: &AppHandle) -> String {
    crate::store::read_value(app, "mono-player-settings")
        .ok()
        .flatten()
        .and_then(|settings| {
            settings
                .get("qualityFallback")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "lower".to_string())
}

#[tauri::command]
pub(crate) fn player_set_cache_dir(
    state: State<'_, PlayerState>,
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    cache_dir: Option<String>,
) -> ApiResponse<CacheDirSnapshot> {
    ApiResponse::from_result((|| {
        let next_cache_dir = match cache_dir
            .as_deref()
            .map(str::trim)
            .filter(|path| !path.is_empty())
        {
            Some(path) => PathBuf::from(normalize_cache_dir_path(path)),
            None => state.default_cache_dir.clone(),
        };

        fs::create_dir_all(&next_cache_dir).map_err(|err| err.to_string())?;
        cleanup_online_audio_cache_files(&next_cache_dir, None);
        let mut current_cache_dir = state.cache_dir.lock().map_err(|err| err.to_string())?;
        *current_cache_dir = next_cache_dir.clone();
        audio_worker.set_cache_dir(online_audio_cache_dir(&next_cache_dir))?;
        Ok(CacheDirSnapshot {
            cache_dir: next_cache_dir.to_string_lossy().to_string(),
        })
    })())
}

#[tauri::command]
pub(crate) fn player_clear_cache(
    state: State<'_, PlayerState>,
) -> ApiResponse<CacheCleanupSnapshot> {
    ApiResponse::from_result((|| {
        let cache_dir = state.cache_dir()?;
        let active_paths = active_cache_paths();
        Ok(clear_cache_files(&cache_dir, &active_paths))
    })())
}

#[tauri::command]
pub(crate) fn player_prune_cache(
    state: State<'_, PlayerState>,
    max_bytes: u64,
) -> ApiResponse<CacheCleanupSnapshot> {
    ApiResponse::from_result((|| {
        let cache_dir = state.cache_dir()?;
        let active_paths = active_cache_paths();
        Ok(prune_cache_files(&cache_dir, &active_paths, max_bytes))
    })())
}

#[tauri::command]
pub(crate) fn player_cache_status(
    state: State<'_, PlayerState>,
) -> ApiResponse<CacheStatusSnapshot> {
    ApiResponse::from_result((|| {
        let cache_dir = state.cache_dir()?;
        let active_paths = active_cache_paths();
        Ok(cache_status(&cache_dir, &active_paths))
    })())
}

#[tauri::command]
pub(crate) fn player_set_queue(
    state: State<'_, PlayerState>,
    tracks: Vec<QueueTrack>,
    current_source: Option<String>,
    playback_mode: String,
    seamless_playback: bool,
    crossfade_playback: bool,
    crossfade_duration_ms: u64,
) -> ApiResponse<QueueSnapshot> {
    ApiResponse::from_result((|| {
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        set_queue_backend(
            &mut backend,
            tracks,
            current_source.as_deref(),
            playback_mode,
            seamless_playback,
            crossfade_playback,
            crossfade_duration_ms,
        );
        Ok(queue_snapshot_from_backend(&mut backend))
    })())
}

#[tauri::command]
pub(crate) async fn player_start_queue(
    state: State<'_, PlayerState>,
    app: AppHandle,
    tracks: Vec<QueueTrack>,
    requested_source: Option<String>,
    playback_mode: String,
    seamless_playback: bool,
    crossfade_playback: bool,
    crossfade_duration_ms: u64,
    start_position: f64,
) -> Result<ApiResponse<QueueSnapshot>, String> {
    let state = Arc::clone(&state.inner);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let (source, queue_index, generation) = {
            let mut backend = state.lock().map_err(|err| err.to_string())?;
            set_queue_backend(
                &mut backend,
                tracks,
                None,
                playback_mode,
                seamless_playback,
                crossfade_playback,
                crossfade_duration_ms,
            );
            let Some((source, queue_index)) =
                initial_queue_source(&mut backend, requested_source.as_deref())
            else {
                return Err("No playable queue source.".to_string());
            };
            backend.queue_index = Some(queue_index);
            let generation = next_playback_generation(&mut backend);
            (source, queue_index, generation)
        };
        let _ = app
            .state::<crate::workers::audio::AudioWorkerState>()
            .stop(false);

        play_worker_queue_source_by_index_at_position(
            &state,
            &app,
            source,
            Some(queue_index),
            start_position,
            false,
            None,
            Some(generation),
        )
    })
    .await
    .map_err(|err| err.to_string())
    .and_then(|result| result);
    Ok(ApiResponse::from_result(result))
}

#[tauri::command]
pub(crate) fn player_queue_snapshot(state: State<'_, PlayerState>) -> ApiResponse<QueueSnapshot> {
    ApiResponse::from_result((|| {
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        Ok(queue_snapshot_from_backend(&mut backend))
    })())
}

#[tauri::command]
pub(crate) async fn player_next(
    state: State<'_, PlayerState>,
    app: AppHandle,
) -> Result<ApiResponse<QueueSnapshot>, String> {
    let state = Arc::clone(&state.inner);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let (source, next_index, generation) = {
            let mut backend = state.lock().map_err(|err| err.to_string())?;
            let (source, next_index) = next_queue_source_from_backend(&mut backend)
                .ok_or_else(|| "No next queue source.".to_string())?;
            let generation = next_playback_generation(&mut backend);
            (source, next_index, generation)
        };
        let _ = app
            .state::<crate::workers::audio::AudioWorkerState>()
            .stop(false);
        play_worker_queue_source_by_index(&state, &app, source, Some(next_index), Some(generation))
    })
    .await
    .map_err(|err| err.to_string())
    .and_then(|result| result);
    Ok(ApiResponse::from_result(result))
}

#[tauri::command]
pub(crate) async fn player_previous(
    state: State<'_, PlayerState>,
    app: AppHandle,
) -> Result<ApiResponse<QueueSnapshot>, String> {
    let state = Arc::clone(&state.inner);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let (source, previous_index) = previous_queue_source(&state)?
            .ok_or_else(|| "No previous queue source.".to_string())?;
        let generation = {
            let mut backend = state.lock().map_err(|err| err.to_string())?;
            next_playback_generation(&mut backend)
        };
        let _ = app
            .state::<crate::workers::audio::AudioWorkerState>()
            .stop(false);
        play_worker_queue_source_by_index(
            &state,
            &app,
            source,
            Some(previous_index),
            Some(generation),
        )
    })
    .await
    .map_err(|err| err.to_string())
    .and_then(|result| result);
    Ok(ApiResponse::from_result(result))
}

#[tauri::command]
pub(crate) async fn player_play_queue_source(
    state: State<'_, PlayerState>,
    app: AppHandle,
    source: String,
) -> Result<ApiResponse<QueueSnapshot>, String> {
    let state = Arc::clone(&state.inner);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let source = normalize_queue_source(&source)
            .ok_or_else(|| "Queue source is not playable.".to_string())?;
        let (queue_index, generation) = {
            let mut backend = state.lock().map_err(|err| err.to_string())?;
            let queue_source = queue_source_key_for_source(&backend.queue_tracks, &source)
                .unwrap_or_else(|| source.clone());
            let queue_index = backend
                .queue_sources
                .iter()
                .position(|item| item == &queue_source);
            let generation = next_playback_generation(&mut backend);
            (queue_index, generation)
        };
        let source = {
            let backend = state.lock().map_err(|err| err.to_string())?;
            queue_index
                .and_then(|index| backend.queue_sources.get(index).cloned())
                .unwrap_or_else(|| source.clone())
        };
        let _ = app
            .state::<crate::workers::audio::AudioWorkerState>()
            .stop(false);
        play_worker_queue_source_by_index(&state, &app, source, queue_index, Some(generation))
    })
    .await
    .map_err(|err| err.to_string())
    .and_then(|result| result);
    Ok(ApiResponse::from_result(result))
}

#[tauri::command]
pub(crate) fn player_queue_insert_next(
    state: State<'_, PlayerState>,
    app: AppHandle,
    track: QueueTrack,
) -> ApiResponse<QueueSnapshot> {
    ApiResponse::from_result((|| {
        let track = normalize_queue_track(track)
            .ok_or_else(|| "Queue track is not playable.".to_string())?;
        let source_key = queue_track_source_key(&track);
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        backend
            .queue_tracks
            .retain(|item| queue_track_source_key(item) != source_key);
        backend.queue_sources.retain(|item| item != &source_key);
        let insert_index = backend
            .queue_index
            .map(|index| index.saturating_add(1).min(backend.queue_sources.len()))
            .unwrap_or(0);
        let track_insert_index = backend
            .queue_tracks
            .iter()
            .position(|item| {
                backend.queue_sources.get(insert_index) == Some(&queue_track_source_key(item))
            })
            .unwrap_or_else(|| insert_index.min(backend.queue_tracks.len()));
        backend.queue_tracks.insert(track_insert_index, track);
        backend
            .queue_sources
            .insert(insert_index, source_key.clone());
        backend.queued_next_source = Some(source_key);
        refresh_queue_index(&mut backend);
        let snapshot = queue_snapshot_from_backend(&mut backend);
        let _ = app.emit("player://queue", &snapshot);
        Ok(snapshot)
    })())
}

#[tauri::command]
pub(crate) fn player_queue_append(
    state: State<'_, PlayerState>,
    app: AppHandle,
    track: QueueTrack,
) -> ApiResponse<QueueSnapshot> {
    ApiResponse::from_result((|| {
        let track = normalize_queue_track(track)
            .ok_or_else(|| "Queue track is not playable.".to_string())?;
        let source_key = queue_track_source_key(&track);
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        backend
            .queue_tracks
            .retain(|item| queue_track_source_key(item) != source_key);
        backend.queue_sources.retain(|item| item != &source_key);
        backend.queue_tracks.push(track);
        backend.queue_sources.push(source_key);
        refresh_queue_index(&mut backend);
        let snapshot = queue_snapshot_from_backend(&mut backend);
        let _ = app.emit("player://queue", &snapshot);
        Ok(snapshot)
    })())
}

#[tauri::command]
pub(crate) fn player_queue_remove(
    state: State<'_, PlayerState>,
    app: AppHandle,
    source: String,
) -> ApiResponse<QueueSnapshot> {
    ApiResponse::from_result((|| {
        let source = normalize_queue_source(&source)
            .ok_or_else(|| "Queue source is not playable.".to_string())?;
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        let source_key =
            queue_source_key_for_source(&backend.queue_tracks, &source).unwrap_or(source);
        backend
            .queue_tracks
            .retain(|item| queue_track_source_key(item) != source_key);
        backend.queue_sources.retain(|item| item != &source_key);
        if backend.queued_next_source.as_deref() == Some(source_key.as_str()) {
            backend.queued_next_source = None;
        }
        refresh_queue_index(&mut backend);
        let snapshot = queue_snapshot_from_backend(&mut backend);
        let _ = app.emit("player://queue", &snapshot);
        Ok(snapshot)
    })())
}

#[tauri::command]
pub(crate) fn player_queue_move(
    state: State<'_, PlayerState>,
    app: AppHandle,
    from_index: usize,
    to_index: usize,
) -> ApiResponse<QueueSnapshot> {
    ApiResponse::from_result((|| {
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        if from_index >= backend.queue_tracks.len() {
            return Ok(queue_snapshot_from_backend(&mut backend));
        }
        let track = backend.queue_tracks.remove(from_index);
        let source = queue_track_source_key(&track);
        let insert_index = to_index.min(backend.queue_tracks.len());
        backend.queue_tracks.insert(insert_index, track);
        backend.queue_sources.retain(|item| item != &source);
        let order_insert_index = to_index.min(backend.queue_sources.len());
        backend.queue_sources.insert(order_insert_index, source);
        refresh_queue_index(&mut backend);
        let snapshot = queue_snapshot_from_backend(&mut backend);
        let _ = app.emit("player://queue", &snapshot);
        Ok(snapshot)
    })())
}

#[tauri::command]
pub(crate) fn player_output_devices(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
) -> ApiResponse<Vec<AudioOutputDevice>> {
    ApiResponse::from_result(audio_worker.list_output_devices())
}

pub(crate) fn list_output_devices_backend() -> Result<Vec<AudioOutputDevice>, String> {
    let host = rodio::cpal::default_host();
    let default_name = host
        .default_output_device()
        .and_then(|device| device.name().ok());
    let devices = host.output_devices().map_err(|err| err.to_string())?;
    let mut output_devices = Vec::new();

    for device in devices {
        let name = device
            .name()
            .unwrap_or_else(|_| "Unknown output device".to_string());
        output_devices.push(AudioOutputDevice {
            id: name.clone(),
            is_default: default_name.as_deref() == Some(name.as_str()),
            name,
        });
    }

    Ok(output_devices)
}

#[tauri::command]
pub(crate) fn player_set_output_device(
    _state: State<'_, PlayerState>,
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    _app: AppHandle,
    device_id: Option<String>,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(audio_worker.set_output_device(device_id))
}

#[tauri::command]
pub(crate) fn player_play_path(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    app: AppHandle,
    path: String,
    restart: bool,
    fade: bool,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        audio_worker.play_path(path, restart, fade, None)?;
        spawn_audio_worker_state_watcher(app, None);
        Ok(())
    })())
}

#[tauri::command]
pub(crate) fn player_play_url(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    app: AppHandle,
    url: String,
    restart: bool,
    fade: bool,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        audio_worker.play_url(url, restart, fade, None)?;
        spawn_audio_worker_state_watcher(app, None);
        Ok(())
    })())
}

#[tauri::command]
pub(crate) fn player_pause(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    fade: bool,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(audio_worker.pause(fade))
}

#[tauri::command]
pub(crate) fn player_stop(
    state: State<'_, PlayerState>,
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    fade: bool,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        {
            let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
            next_playback_generation(&mut backend);
        }
        audio_worker.stop(fade)?;
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        backend.current_source = None;
        refresh_queue_index(&mut backend);
        Ok(())
    })())
}

#[tauri::command]
pub(crate) fn player_seek(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    seconds: f64,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(audio_worker.seek(seconds))
}

#[tauri::command]
pub(crate) fn player_set_volume(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    volume: f32,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(audio_worker.set_volume(volume))
}

#[tauri::command]
pub(crate) fn player_set_speed(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
    speed: f32,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(audio_worker.set_speed(speed))
}

#[tauri::command]
pub(crate) fn player_state(
    audio_worker: State<'_, crate::workers::audio::AudioWorkerState>,
) -> ApiResponse<PlayerSnapshot> {
    ApiResponse::from_result(audio_worker.state())
}

pub(crate) fn mcp_player_state(app: &AppHandle) -> Result<PlayerSnapshot, String> {
    app.state::<crate::workers::audio::AudioWorkerState>()
        .state()
}

pub(crate) fn mcp_queue_snapshot(app: &AppHandle) -> Result<QueueSnapshot, String> {
    let state = app.state::<PlayerState>();
    queue_snapshot(&state.inner)
}

pub(crate) fn mcp_play_path(app: &AppHandle, path: String) -> Result<(), String> {
    app.state::<crate::workers::audio::AudioWorkerState>()
        .play_path(path.clone(), true, false, None)?;

    {
        let state = app.state::<PlayerState>();
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        backend.current_source = Some(path);
        refresh_queue_index(&mut backend);
        let snapshot = queue_snapshot_from_backend(&mut backend);
        let _ = app.emit("player://queue", &snapshot);
    }

    spawn_audio_worker_state_watcher(app.clone(), None);
    Ok(())
}

pub(crate) fn mcp_play_online_track(
    app: &AppHandle,
    url: String,
    metadata: McpOnlineTrackMetadata,
) -> Result<QueueSnapshot, String> {
    app.state::<crate::workers::audio::AudioWorkerState>()
        .play_url(url.clone(), true, false, None)?;

    let track = online_queue_track(
        online_track_id(&url, &metadata),
        url.clone(),
        metadata.title,
        metadata.artist,
        metadata.album,
        metadata.duration,
        metadata.artwork,
        metadata.lyrics,
        metadata.source_id,
        metadata.source_name,
        metadata.source_provider_id,
    );
    let snapshot = {
        let state = app.state::<PlayerState>();
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        backend.current_source = Some(url.clone());
        backend.queue_tracks = vec![track];
        backend.queue_sources = vec![url];
        backend.queue_index = Some(0);
        backend.queued_next_source = None;
        let snapshot = queue_snapshot_from_backend(&mut backend);
        let _ = app.emit("player://queue", &snapshot);
        snapshot
    };

    spawn_audio_worker_state_watcher(app.clone(), None);
    Ok(snapshot)
}

pub(crate) fn mcp_pause(app: &AppHandle) -> Result<(), String> {
    app.state::<crate::workers::audio::AudioWorkerState>()
        .pause(false)
}

pub(crate) fn mcp_resume(app: &AppHandle) -> Result<(), String> {
    let snapshot = mcp_player_state(app)?;
    let Some(path) = snapshot.current_path else {
        return Err("No current track to resume.".to_string());
    };
    let audio_worker = app.state::<crate::workers::audio::AudioWorkerState>();
    if is_rust_playable_url(&path) {
        audio_worker.play_url(path, false, false, None)?;
    } else {
        audio_worker.play_path(path, false, false, None)?;
    }
    spawn_audio_worker_state_watcher(app.clone(), None);
    Ok(())
}

pub(crate) fn mcp_stop(app: &AppHandle) -> Result<(), String> {
    {
        let state = app.state::<PlayerState>();
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        next_playback_generation(&mut backend);
    }
    app.state::<crate::workers::audio::AudioWorkerState>()
        .stop(false)?;
    let state = app.state::<PlayerState>();
    let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
    backend.current_source = None;
    refresh_queue_index(&mut backend);
    Ok(())
}

pub(crate) fn mcp_next(app: &AppHandle) -> Result<QueueSnapshot, String> {
    let state = app.state::<PlayerState>();
    let (source, next_index, generation) = {
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        let (source, next_index) = next_queue_source_from_backend(&mut backend)
            .ok_or_else(|| "No next queue source.".to_string())?;
        let generation = next_playback_generation(&mut backend);
        (source, next_index, generation)
    };
    play_worker_queue_source_by_index(
        &state.inner,
        app,
        source,
        Some(next_index),
        Some(generation),
    )
}

pub(crate) fn mcp_previous(app: &AppHandle) -> Result<QueueSnapshot, String> {
    let state = app.state::<PlayerState>();
    let (source, previous_index) = previous_queue_source(&state.inner)?
        .ok_or_else(|| "No previous queue source.".to_string())?;
    let generation = {
        let mut backend = state.inner.lock().map_err(|err| err.to_string())?;
        next_playback_generation(&mut backend)
    };
    play_worker_queue_source_by_index(
        &state.inner,
        app,
        source,
        Some(previous_index),
        Some(generation),
    )
}

pub(crate) fn mcp_seek(app: &AppHandle, seconds: f64) -> Result<(), String> {
    app.state::<crate::workers::audio::AudioWorkerState>()
        .seek(seconds)
}

pub(crate) fn mcp_set_volume(app: &AppHandle, volume: f32) -> Result<(), String> {
    app.state::<crate::workers::audio::AudioWorkerState>()
        .set_volume(volume)
}

fn online_track_id(url: &str, metadata: &McpOnlineTrackMetadata) -> i64 {
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    metadata.title.hash(&mut hasher);
    metadata.source_id.hash(&mut hasher);
    metadata.source_provider_id.hash(&mut hasher);
    -((hasher.finish() & 0x7fff_ffff) as i64) - 1
}

fn spawn_audio_worker_state_watcher(app: AppHandle, generation: Option<u64>) {
    thread::spawn(move || {
        let mut inactive_ticks = 0_u8;
        let mut had_active_source = false;
        loop {
            if let Some(expected_generation) = generation {
                let player_state = app.state::<PlayerState>();
                if current_playback_generation(&player_state.inner).ok()
                    != Some(expected_generation)
                {
                    break;
                }
            }

            let snapshot = {
                let audio_worker = app.state::<crate::workers::audio::AudioWorkerState>();
                match audio_worker.state() {
                    Ok(snapshot) => snapshot,
                    Err(_) => break,
                }
            };

            let _ = app.emit("player://state", &snapshot);

            if snapshot.current_path.is_some() {
                had_active_source = true;
            }

            if snapshot.current_path.is_none() {
                if had_active_source {
                    if !advance_worker_queue_after_end(&app).unwrap_or(false) {
                        let _ = app.emit("player://ended", ());
                    }
                    had_active_source = false;
                }
                inactive_ticks = inactive_ticks.saturating_add(1);
            } else if !snapshot.is_playing {
                inactive_ticks = inactive_ticks.saturating_add(1);
            } else {
                inactive_ticks = 0;
            }

            if inactive_ticks >= 4 {
                break;
            }

            thread::sleep(Duration::from_millis(250));
        }
    });
}

fn advance_worker_queue_after_end(app: &AppHandle) -> Result<bool, String> {
    let player_state = app.state::<PlayerState>();
    let Some((source, next_index)) = next_queue_source(&player_state.inner)? else {
        return Ok(false);
    };
    let generation = {
        let mut backend = player_state.inner.lock().map_err(|err| err.to_string())?;
        next_playback_generation(&mut backend)
    };
    play_worker_queue_source_by_index(
        &player_state.inner,
        app,
        source,
        Some(next_index),
        Some(generation),
    )?;
    Ok(true)
}

fn resolve_queue_source_for_playback(
    state: &Arc<Mutex<PlayerBackend>>,
    app: &AppHandle,
    source: String,
    queue_index: Option<usize>,
    generation: Option<u64>,
) -> Result<String, String> {
    if !is_plugin_queue_source(&source) {
        return Ok(source);
    }

    let track = {
        let backend = state.lock().map_err(|err| err.to_string())?;
        queue_index
            .and_then(|index| backend.queue_sources.get(index))
            .and_then(|source| queue_track_for_source(&backend, source))
            .or_else(|| queue_track_for_source(&backend, &source))
            .ok_or_else(|| "Plugin queue track is missing.".to_string())?
    };
    let provider_id = track
        .source_provider_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Plugin queue track is missing sourceProviderId.".to_string())?;
    let plugins = read_installed_playback_plugins(app)?;
    let quality_fallback = read_quality_fallback(app);
    let track_value = queue_track_plugin_value(&track);
    let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
    let source_result = crate::plugins::resolve_plugin_playback_source_backend(
        &worker,
        provider_id,
        track_value,
        None,
        quality_fallback,
        false,
        plugins,
    )?;
    let resolved_source = source_result.url.clone();

    if let Some(expected_generation) = generation {
        if current_playback_generation(state)? != expected_generation {
            return Err("Playback request was replaced.".to_string());
        }
    }

    {
        let mut backend = state.lock().map_err(|err| err.to_string())?;
        let track_key = queue_track_source_key(&track);
        if let Some(queue_track) = backend
            .queue_tracks
            .iter_mut()
            .find(|item| queue_track_source_key(item) == track_key)
        {
            queue_track.path = resolved_source.clone();
            queue_track.title = if source_result.title.trim().is_empty() {
                queue_track.title.clone()
            } else {
                source_result.title.clone()
            };
            queue_track.artist = (!source_result.artist.trim().is_empty())
                .then_some(source_result.artist.clone())
                .or(queue_track.artist.clone());
            queue_track.album = (!source_result.album.trim().is_empty())
                .then_some(source_result.album.clone())
                .or(queue_track.album.clone());
            queue_track.duration = source_result
                .duration
                .map(|duration| duration as f64)
                .or(queue_track.duration);
            queue_track.artwork = source_result
                .artwork
                .clone()
                .or(queue_track.artwork.clone());
        }
    }

    Ok(resolved_source)
}

fn play_worker_queue_source_by_index(
    state: &Arc<Mutex<PlayerBackend>>,
    app: &AppHandle,
    source: String,
    queue_index: Option<usize>,
    generation: Option<u64>,
) -> Result<QueueSnapshot, String> {
    let (fade, fade_duration_ms) = queue_crossfade_options(state)?;
    play_worker_queue_source_by_index_at_position(
        state,
        app,
        source,
        queue_index,
        0.0,
        fade,
        fade_duration_ms,
        generation,
    )
}

fn commit_pending_queue_source(
    state: &Arc<Mutex<PlayerBackend>>,
    app: &AppHandle,
    source: &str,
    queue_index: Option<usize>,
) -> Result<(), String> {
    let snapshot = {
        let mut backend = state.lock().map_err(|err| err.to_string())?;
        backend.current_source = Some(source.to_string());
        backend.queue_index = queue_index;
        queue_snapshot_from_backend(&mut backend)
    };
    let _ = app.emit("player://queue", &snapshot);
    Ok(())
}

fn play_worker_queue_source_by_index_at_position(
    state: &Arc<Mutex<PlayerBackend>>,
    app: &AppHandle,
    source: String,
    queue_index: Option<usize>,
    position: f64,
    fade: bool,
    fade_duration_ms: Option<u64>,
    generation: Option<u64>,
) -> Result<QueueSnapshot, String> {
    commit_pending_queue_source(state, app, &source, queue_index)?;
    let source = match resolve_queue_source_for_playback(state, app, source, queue_index, generation) {
        Ok(source) => source,
        Err(error) if error == "Playback request was replaced." => return queue_snapshot(state),
        Err(error) => return Err(error),
    };
    let audio_worker = app.state::<crate::workers::audio::AudioWorkerState>();
    if is_rust_playable_url(&source) {
        audio_worker.play_url(source.clone(), true, fade, fade_duration_ms)?;
    } else {
        let path = PathBuf::from(source.trim());
        if !path.is_file() {
            return Err("Audio file does not exist.".to_string());
        }
        audio_worker.play_path(source.clone(), true, fade, fade_duration_ms)?;
    }
    if position > 0.0 {
        audio_worker.seek(position)?;
    }

    {
        let mut backend = state.lock().map_err(|err| err.to_string())?;
        backend.current_source = Some(source.clone());
        backend.queue_index = queue_index;
    }

    let snapshot = queue_snapshot(state)?;
    let _ = app.emit("player://advanced", source);
    let _ = app.emit("player://queue", &snapshot);
    spawn_audio_worker_state_watcher(app.clone(), generation);
    Ok(snapshot)
}
