use super::{current_playback_generation, next_playback_generation, queue::*, PlayerState};
use tauri::{AppHandle, Manager};

pub(super) fn resume(app: &AppHandle) -> Result<(), String> {
    let worker = app.state::<crate::workers::audio::AudioWorkerState>();
    let state = app.state::<PlayerState>();
    if worker.state()?.current_path.is_some() {
        worker.resume()?;
        let generation = current_playback_generation(&state.inner)?;
        super::spawn_audio_worker_state_watcher(app.clone(), Some(generation));
        return Ok(());
    }
    let (source, index, position, generation) = {
        let mut backend = state.inner.lock().map_err(|e| e.to_string())?;
        let (source, index, position) = restored_source(&backend)?;
        let generation = next_playback_generation(&mut backend);
        (source, index, position, generation)
    };
    let snapshot = super::play_queue_source_at_position(
        &state.inner,
        app,
        source,
        index,
        position,
        false,
        None,
        Some(generation),
        None,
    )?;
    super::emit_queue_snapshot(app, "resume_session", &snapshot);
    Ok(())
}

fn restored_source(backend: &PlayerBackend) -> Result<(String, Option<usize>, f64), String> {
    let source = backend
        .current_source
        .as_deref()
        .ok_or_else(|| "No active audio to resume.".to_string())?;
    let track = queue_track_for_source(backend, source)
        .or_else(|| {
            backend
                .queue_index
                .and_then(|index| backend.queue_sources.get(index))
                .and_then(|source| queue_track_for_source(backend, source))
        })
        .ok_or_else(|| "No active audio to resume.".to_string())?;
    let position = if backend.session_source.as_deref() == Some(source) {
        backend.session_position.max(0.0)
    } else {
        0.0
    };
    // Resolve online identities again instead of reusing an expired playback URL.
    let source = queue_track_plugin_source_key(&track).unwrap_or(track.path);
    Ok((source, backend.queue_index, position))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn restores_saved_position_and_resolves_online_identity() {
        for online in [false, true] {
            let path = if online {
                "https://old.example/song"
            } else {
                "D:/Music/song.mp3"
            };
            let track = serde_json::from_value(json!({
                "id": 1, "title": "Song", "path": path,
                "sourceProviderId": if online { Some("provider") } else { None },
                "sourceId": if online { Some("song") } else { None }
            }))
            .unwrap();
            let mut backend = PlayerBackend::default();
            set_queue_backend(
                &mut backend,
                vec![track],
                Some(path),
                "repeat".into(),
                false,
                false,
                3000,
            );
            backend.current_source = Some(path.into());
            backend.session_source = Some(path.into());
            backend.session_position = 36.0;
            let (source, _, position) = restored_source(&backend).unwrap();
            assert_eq!(position, 36.0);
            assert_eq!(
                source,
                if online {
                    "plugin://provider/song"
                } else {
                    path
                }
            );
            backend.session_source = Some("another-song".into());
            assert_eq!(restored_source(&backend).unwrap().2, 0.0);
        }
    }

    #[test]
    fn empty_player_cannot_resume() {
        assert!(restored_source(&PlayerBackend::default()).is_err());
    }
}
