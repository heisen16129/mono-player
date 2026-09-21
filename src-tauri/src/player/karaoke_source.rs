use super::*;

fn same_source(left: &str, right: &str) -> bool {
    if left == right { return true; }
    if left.contains("://") || right.contains("://") { return false; }
    if let (Ok(left), Ok(right)) = (Path::new(left).canonicalize(), Path::new(right).canonicalize()) {
        return left == right;
    }
    #[cfg(windows)]
    { return left.replace('\\', "/").eq_ignore_ascii_case(&right.replace('\\', "/")); }
    #[cfg(not(windows))]
    false
}

fn matches_track(track: &QueueTrack, source: &str, provider_id: Option<&str>, track_id: Option<&str>) -> bool {
    match (provider_id.filter(|s| !s.is_empty()), track_id.filter(|s| !s.is_empty())) {
        (Some(provider), Some(id)) => track.source_provider_id.as_deref() == Some(provider) && track.source_id.as_deref() == Some(id),
        _ => same_source(&track.path, source),
    }
}

#[tauri::command]
pub(crate) async fn karaoke_playback_source(app: AppHandle, source: String, provider_id: Option<String>, track_id: Option<String>) -> ApiResponse<Option<String>> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<PlayerState>();
        let backend = state.inner.lock().map_err(|e| e.to_string())?;
        let Some(current) = backend.current_source.as_deref() else { return Ok(None); };
        let Some(track) = queue_track_for_source(&backend, current) else { return Ok(None); };
        if !matches_track(&track, &source, provider_id.as_deref(), track_id.as_deref()) { return Ok(None); }
        let audio = app.state::<crate::workers::audio::AudioWorkerState>().state()?;
        // Restored queue metadata does not mean an audio source has been loaded.
        Ok(audio.current_path.filter(|path| same_source(path, current)))
    }).await.map_err(|e| e.to_string()).and_then(|r| r))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn online_identity_survives_resolved_url_changes() {
        let track: QueueTrack = serde_json::from_value(json!({"id": 1, "path": "https://audio/new", "title": "Song", "sourceProviderId": "provider", "sourceId": "song"})).unwrap();
        assert!(matches_track(&track, "plugin://provider/song", Some("provider"), Some("song")));
        assert!(!matches_track(&track, "https://audio/new", Some("provider"), Some("other")));
        assert!(!matches_track(&track, "https://audio/new", Some("other-provider"), Some("song")));
    }

    #[test]
    fn url_case_remains_significant() {
        assert!(!same_source("https://audio/A", "https://audio/a"));
    }

    #[test]
    #[cfg(windows)]
    fn windows_path_spellings_match() {
        assert!(same_source("D:\\Music\\Song.mp3", "d:/music/song.mp3"));
        assert!(!same_source("D:\\Music\\Song.mp3", "d:/music/other.mp3"));
    }
}
