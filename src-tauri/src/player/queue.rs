use crate::models::TrackLyrics;
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

static RANDOM_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(super) struct PlayerBackend {
    pub(super) current_source: Option<String>,
    pub(super) queue_tracks: Vec<QueueTrack>,
    pub(super) queue_sources: Vec<String>,
    pub(super) queue_index: Option<usize>,
    pub(super) queued_next_source: Option<String>,
    pub(super) playback_generation: u64,
    playback_mode: String,
    crossfade_playback: bool,
    crossfade_duration: Duration,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QueueTrack {
    pub(super) id: i64,
    pub(super) path: String,
    pub(super) title: String,
    pub(super) artist: Option<String>,
    pub(super) album: Option<String>,
    pub(super) duration: Option<f64>,
    pub(super) artwork: Option<String>,
    pub(super) lyrics: Option<TrackLyrics>,
    pub(super) source_id: Option<String>,
    pub(super) source_name: Option<String>,
    pub(super) source_provider_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QueueSnapshot {
    tracks: Vec<QueueTrack>,
    sources: Vec<String>,
    current_source: Option<String>,
    current_index: Option<usize>,
    playback_mode: String,
}

impl Default for PlayerBackend {
    fn default() -> Self {
        Self {
            current_source: None,
            queue_tracks: Vec::new(),
            queue_sources: Vec::new(),
            queue_index: None,
            queued_next_source: None,
            playback_generation: 0,
            playback_mode: "repeat".to_string(),
            crossfade_playback: false,
            crossfade_duration: Duration::from_millis(3000),
        }
    }
}

pub(super) fn set_queue_backend(
    backend: &mut PlayerBackend,
    tracks: Vec<QueueTrack>,
    current_source: Option<&str>,
    playback_mode: String,
    _seamless_playback: bool,
    crossfade_playback: bool,
    crossfade_duration_ms: u64,
) {
    let next_queue_tracks: Vec<QueueTrack> = tracks
        .into_iter()
        .filter_map(normalize_queue_track)
        .collect();
    let next_playback_mode = match playback_mode.as_str() {
        "shuffle" | "fixed" => playback_mode,
        _ => "repeat".to_string(),
    };
    let active_source = current_source
        .map(str::trim)
        .filter(|source| !source.is_empty())
        .or(backend.current_source.as_deref())
        .and_then(|source| {
            queue_source_key_for_source(&next_queue_tracks, source)
                .or_else(|| normalize_queue_source(source))
        });
    let next_queue_sources = build_play_order_sources(
        &next_queue_tracks,
        active_source.as_deref(),
        &next_playback_mode,
    );
    backend.queue_tracks = next_queue_tracks;
    backend.queue_sources = next_queue_sources;
    backend.playback_mode = next_playback_mode;
    backend.crossfade_playback = crossfade_playback;
    backend.crossfade_duration = Duration::from_millis(crossfade_duration_ms.clamp(300, 30_000));

    backend.queue_index = active_source
        .as_deref()
        .and_then(|source| queue_order_index_for_source(backend, source));
    if !backend
        .queued_next_source
        .as_ref()
        .is_some_and(|source| backend.queue_sources.iter().any(|item| item == source))
    {
        backend.queued_next_source = None;
    }
}

pub(super) fn initial_queue_source(
    backend: &PlayerBackend,
    requested_source: Option<&str>,
) -> Option<(String, usize)> {
    if backend.queue_sources.is_empty() {
        return None;
    }

    if let Some(source) = requested_source
        .map(str::trim)
        .filter(|source| !source.is_empty())
        .and_then(|source| {
            queue_source_key_for_source(&backend.queue_tracks, source)
                .or_else(|| normalize_queue_source(source))
        })
    {
        if let Some(index) = queue_order_index_for_source(backend, &source) {
            if queue_source_exists_for_backend(backend, &source) {
                return Some((source, index));
            }
        }
    }

    let index = match backend.playback_mode.as_str() {
        "shuffle" if backend.queue_sources.len() > 1 => random_valid_queue_index(backend, None),
        _ => first_valid_queue_index(backend),
    }?;

    queue_source_at(backend, index)
}

pub(super) fn previous_queue_source(
    state: &Arc<Mutex<PlayerBackend>>,
) -> Result<Option<(String, usize)>, String> {
    let mut backend = state.lock().map_err(|err| err.to_string())?;
    if backend.queue_sources.is_empty() {
        return Ok(None);
    }

    let previous_index = previous_queue_index(&mut backend);

    Ok(previous_index.and_then(|index| queue_source_at(&backend, index)))
}

pub(super) fn next_queue_source(
    state: &Arc<Mutex<PlayerBackend>>,
) -> Result<Option<(String, usize)>, String> {
    let mut backend = state.lock().map_err(|err| err.to_string())?;
    Ok(next_queue_source_from_backend(&mut backend))
}

pub(super) fn next_queue_source_from_backend(
    backend: &mut PlayerBackend,
) -> Option<(String, usize)> {
    if backend.queue_sources.is_empty() {
        return None;
    }

    if let Some(source) = backend.queued_next_source.take() {
        if let Some(index) = queue_order_index_for_source(backend, &source) {
            if queue_source_exists_for_backend(backend, &source) {
                return Some((source, index));
            }
        }
    }

    let next_index = next_queue_index(backend);

    next_index.and_then(|index| queue_source_at(backend, index))
}

pub(super) fn queue_snapshot(state: &Arc<Mutex<PlayerBackend>>) -> Result<QueueSnapshot, String> {
    let mut backend = state.lock().map_err(|err| err.to_string())?;
    Ok(queue_snapshot_from_backend(&mut backend))
}

pub(super) fn queue_snapshot_from_backend(backend: &PlayerBackend) -> QueueSnapshot {
    QueueSnapshot {
        tracks: backend.queue_tracks.clone(),
        sources: backend.queue_sources.clone(),
        current_source: backend.current_source.clone(),
        current_index: backend.queue_index,
        playback_mode: backend.playback_mode.clone(),
    }
}

pub(super) fn queue_crossfade_options(
    state: &Arc<Mutex<PlayerBackend>>,
) -> Result<(bool, Option<u64>), String> {
    let backend = state.lock().map_err(|err| err.to_string())?;
    let fade = backend.crossfade_playback && backend.current_source.is_some();
    let duration_ms = fade.then_some(backend.crossfade_duration.as_millis() as u64);
    Ok((fade, duration_ms))
}

pub(super) fn queue_playback_options(backend: &PlayerBackend) -> (String, bool, u64) {
    (
        backend.playback_mode.clone(),
        backend.crossfade_playback,
        backend.crossfade_duration.as_millis() as u64,
    )
}

pub(super) fn refresh_queue_index(backend: &mut PlayerBackend) {
    backend.queue_index = backend
        .current_source
        .as_ref()
        .and_then(|source| queue_order_index_for_source(backend, source));
}

pub(super) fn normalize_queue_source(source: &str) -> Option<String> {
    let source = source.trim();
    if is_rust_playable_source(source) {
        Some(source.to_string())
    } else {
        None
    }
}

pub(super) fn normalize_queue_track(mut track: QueueTrack) -> Option<QueueTrack> {
    track.path = track.path.trim().to_string();
    if is_rust_playable_source(&track.path)
        && (!is_plugin_queue_source(&track.path)
            || (track
                .source_provider_id
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
                && track
                    .source_id
                    .as_deref()
                    .is_some_and(|value| !value.trim().is_empty())))
    {
        Some(track)
    } else {
        None
    }
}

pub(super) fn is_rust_playable_url(source: &str) -> bool {
    source.starts_with("http://") || source.starts_with("https://")
}

pub(super) fn is_plugin_queue_source(source: &str) -> bool {
    source.trim().starts_with("plugin://")
}

fn is_rust_playable_source(source: &str) -> bool {
    let source = source.trim();
    !source.is_empty()
        && (is_rust_playable_url(source)
            || is_plugin_queue_source(source)
            || !source.contains("://"))
}

fn queue_source_exists(source: &str) -> bool {
    let source = source.trim();
    if !is_rust_playable_source(source) {
        return false;
    }
    if is_rust_playable_url(source) {
        return true;
    }
    if is_plugin_queue_source(source) {
        return true;
    }

    Path::new(source).is_file()
}

pub(super) fn queue_track_source_key(track: &QueueTrack) -> String {
    let path = track.path.trim();
    if !path.is_empty() && !is_rust_playable_url(path) && !is_plugin_queue_source(path) {
        return track.path.clone();
    }

    match (
        track.source_provider_id.as_deref(),
        track.source_id.as_deref(),
    ) {
        (Some(provider_id), Some(source_id))
            if !provider_id.trim().is_empty() && !source_id.trim().is_empty() =>
        {
            format!("plugin://{}/{}", provider_id.trim(), source_id.trim())
        }
        _ => track.path.clone(),
    }
}

fn build_play_order_sources(
    tracks: &[QueueTrack],
    active_source: Option<&str>,
    playback_mode: &str,
) -> Vec<String> {
    let mut sources = tracks
        .iter()
        .map(queue_track_source_key)
        .collect::<Vec<_>>();
    if playback_mode != "shuffle" || sources.len() <= 1 {
        return sources;
    }

    for index in (1..sources.len()).rev() {
        let swap_index = random_usize(index + 1);
        sources.swap(index, swap_index);
    }

    if let Some(active_source) = active_source {
        if let Some(index) = sources.iter().position(|source| source == active_source) {
            sources.swap(0, index);
        }
    }

    sources
}

pub(super) fn queue_source_key_for_source(tracks: &[QueueTrack], source: &str) -> Option<String> {
    let source = source.trim();
    if source.is_empty() {
        return None;
    }

    tracks.iter().find_map(|track| {
        let key = queue_track_source_key(track);
        (key == source || track.path == source).then_some(key)
    })
}

fn queue_order_index_for_source(backend: &PlayerBackend, source: &str) -> Option<usize> {
    let source_key = queue_source_key_for_source(&backend.queue_tracks, source)
        .unwrap_or_else(|| source.to_string());
    backend
        .queue_sources
        .iter()
        .position(|item| item == &source_key)
}

pub(super) fn queue_track_for_source(backend: &PlayerBackend, source: &str) -> Option<QueueTrack> {
    backend
        .queue_tracks
        .iter()
        .find(|track| queue_track_source_key(track) == source || track.path == source)
        .cloned()
}

fn queue_source_exists_for_backend(backend: &PlayerBackend, source: &str) -> bool {
    if is_plugin_queue_source(source) && queue_track_for_source(backend, source).is_some() {
        return true;
    }

    queue_source_exists(source)
}

fn queue_source_at(backend: &PlayerBackend, index: usize) -> Option<(String, usize)> {
    backend
        .queue_sources
        .get(index)
        .filter(|source| queue_source_exists_for_backend(backend, source))
        .cloned()
        .map(|source| (source, index))
}

fn first_valid_queue_index(backend: &PlayerBackend) -> Option<usize> {
    backend
        .queue_sources
        .iter()
        .position(|source| queue_source_exists_for_backend(backend, source))
}

fn current_queue_index(backend: &PlayerBackend) -> Option<usize> {
    backend.queue_index.or_else(|| {
        backend
            .current_source
            .as_ref()
            .and_then(|source| queue_order_index_for_source(backend, source))
    })
}

fn next_queue_index(backend: &mut PlayerBackend) -> Option<usize> {
    if let Some(source) = backend.queued_next_source.take() {
        if let Some(index) = queue_order_index_for_source(backend, &source) {
            return Some(index);
        }
    }

    calculate_next_queue_index(backend)
}

fn calculate_next_queue_index(backend: &PlayerBackend) -> Option<usize> {
    if backend.queue_sources.is_empty() {
        return None;
    }

    if let Some(source) = backend.queued_next_source.as_deref() {
        if let Some(index) = queue_order_index_for_source(backend, source) {
            return Some(index);
        }
    }

    let current_index = current_queue_index(backend).unwrap_or(0);
    match backend.playback_mode.as_str() {
        "fixed" => Some(current_index),
        _ => next_valid_queue_index(backend, current_index),
    }
}

fn previous_queue_index(backend: &mut PlayerBackend) -> Option<usize> {
    calculate_previous_queue_index(backend)
}

fn calculate_previous_queue_index(backend: &PlayerBackend) -> Option<usize> {
    if backend.queue_sources.is_empty() {
        return None;
    }

    let current_index = current_queue_index(backend).unwrap_or(0);
    match backend.playback_mode.as_str() {
        "fixed" => Some(current_index),
        _ => previous_valid_queue_index(backend, current_index),
    }
}

fn next_valid_queue_index(backend: &PlayerBackend, current_index: usize) -> Option<usize> {
    let len = backend.queue_sources.len();
    for offset in 1..=len {
        let index = (current_index + offset) % len;
        if queue_source_exists_for_backend(backend, &backend.queue_sources[index]) {
            return Some(index);
        }
    }
    None
}

fn previous_valid_queue_index(backend: &PlayerBackend, current_index: usize) -> Option<usize> {
    let len = backend.queue_sources.len();
    for offset in 1..=len {
        let index = (current_index + len - offset) % len;
        if queue_source_exists_for_backend(backend, &backend.queue_sources[index]) {
            return Some(index);
        }
    }
    None
}

fn random_valid_queue_index(
    backend: &PlayerBackend,
    excluded_index: Option<usize>,
) -> Option<usize> {
    let mut candidates = backend
        .queue_sources
        .iter()
        .enumerate()
        .filter_map(|(index, source)| {
            (Some(index) != excluded_index && queue_source_exists_for_backend(backend, source))
                .then_some(index)
        })
        .collect::<Vec<_>>();

    if candidates.is_empty() {
        if let Some(index) = excluded_index {
            if queue_source_exists_for_backend(backend, &backend.queue_sources[index]) {
                candidates.push(index);
            }
        }
    }

    candidates.get(random_usize(candidates.len())).copied()
}

fn random_usize(max: usize) -> usize {
    if max == 0 {
        return 0;
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(0);
    let counter = RANDOM_COUNTER.fetch_add(0x9e37_79b9_7f4a_7c15, Ordering::Relaxed);
    let mut value = now ^ counter.rotate_left(17) ^ ((max as u64) << 32);
    value ^= value << 13;
    value ^= value >> 7;
    value ^= value << 17;
    (value as usize) % max
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs::{remove_file, File},
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static TEMP_AUDIO_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn temp_audio_file() -> String {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let counter = TEMP_AUDIO_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("mono-queue-test-{millis}-{counter}.mp3"));
        File::create(&path).expect("create temp audio file");
        path.to_string_lossy().to_string()
    }

    fn plugin_track(source_id: Option<&str>, provider_id: Option<&str>) -> QueueTrack {
        QueueTrack {
            id: -1,
            path: "plugin://provider/song-1".to_string(),
            title: "Song".to_string(),
            artist: Some("Artist".to_string()),
            album: None,
            duration: None,
            artwork: None,
            lyrics: None,
            source_id: source_id.map(str::to_string),
            source_name: Some("Provider".to_string()),
            source_provider_id: provider_id.map(str::to_string),
        }
    }

    #[test]
    fn next_queue_source_skips_missing_local_files() {
        let valid_source = temp_audio_file();
        let missing_source = std::env::temp_dir()
            .join("mono-queue-test-missing-next.mp3")
            .to_string_lossy()
            .to_string();
        let mut backend = PlayerBackend {
            current_source: Some(missing_source.clone()),
            queue_sources: vec![missing_source, valid_source.clone()],
            queue_index: Some(0),
            ..PlayerBackend::default()
        };

        let next = next_queue_source_from_backend(&mut backend);
        let _ = remove_file(&valid_source);

        assert_eq!(next, Some((valid_source, 1)));
    }

    #[test]
    fn initial_queue_source_ignores_missing_requested_local_file() {
        let valid_source = temp_audio_file();
        let missing_source = std::env::temp_dir()
            .join("mono-queue-test-missing-initial.mp3")
            .to_string_lossy()
            .to_string();
        let backend = PlayerBackend {
            queue_sources: vec![missing_source.clone(), valid_source.clone()],
            ..PlayerBackend::default()
        };

        let initial = initial_queue_source(&backend, Some(&missing_source));
        let _ = remove_file(&valid_source);

        assert_eq!(initial, Some((valid_source, 1)));
    }

    #[test]
    fn queued_next_source_wins_in_shuffle_mode() {
        let first = temp_audio_file();
        let second = temp_audio_file();
        let third = temp_audio_file();
        let mut backend = PlayerBackend {
            current_source: Some(first.clone()),
            queue_sources: vec![first.clone(), second.clone(), third.clone()],
            queue_index: Some(0),
            queued_next_source: Some(third.clone()),
            playback_mode: "shuffle".to_string(),
            ..PlayerBackend::default()
        };

        let next = next_queue_source_from_backend(&mut backend);
        let _ = remove_file(&first);
        let _ = remove_file(&second);
        let _ = remove_file(&third);

        assert_eq!(next, Some((third, 2)));
        assert!(backend.queued_next_source.is_none());
    }

    #[test]
    fn plugin_queue_sources_are_valid_when_track_has_provider_and_source() {
        let track = normalize_queue_track(plugin_track(Some("song-1"), Some("provider")));

        assert!(track.is_some());
        assert!(queue_source_exists("plugin://provider/song-1"));
    }

    #[test]
    fn plugin_queue_tracks_without_source_identity_are_filtered() {
        assert!(normalize_queue_track(plugin_track(None, Some("provider"))).is_none());
        assert!(normalize_queue_track(plugin_track(Some("song-1"), None)).is_none());
    }

}
