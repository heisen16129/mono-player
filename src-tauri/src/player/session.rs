use super::{queue::*, PlayerState};
use crate::{api_response::ApiResponse, database::playback_session, state::AppState};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlaybackSession {
    current_track: Option<QueueTrack>,
    queue_tracks: Vec<QueueTrack>,
    current_time: f64,
    playback_mode: String,
}

pub(crate) fn save(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<PlayerState>();
    let backend = state.inner.lock().map_err(|e| e.to_string())?;
    let Some(session) = snapshot(&backend) else {
        return Ok(());
    };
    let payload = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    let db = app.state::<AppState>();
    let db = db.db.lock().map_err(|e| e.to_string())?;
    playback_session::save(&db, &payload)
}

fn snapshot(backend: &PlayerBackend) -> Option<PlaybackSession> {
    // An untouched player must not replace the previous session during startup.
    if !backend.session_initialized {
        return None;
    }
    let current_track = backend
        .current_source
        .as_deref()
        .and_then(|source| queue_track_for_source(backend, source))
        .or_else(|| {
            backend
                .queue_index
                .and_then(|index| backend.queue_sources.get(index))
                .and_then(|source| queue_track_for_source(backend, source))
        });
    Some(PlaybackSession {
        current_time: if current_track.is_some() && backend.current_source == backend.session_source
        {
            backend.session_position
        } else {
            0.0
        },
        current_track,
        queue_tracks: backend.queue_tracks.clone(),
        playback_mode: queue_playback_options(backend).0,
    })
}

pub(crate) fn save_logged(app: &AppHandle) {
    if let Err(error) = save(app) {
        eprintln!("[playback-session] {error}");
    }
}

#[tauri::command]
pub(crate) fn player_read_session(app: AppHandle) -> ApiResponse<Option<PlaybackSession>> {
    ApiResponse::from_result((|| {
        let payload = {
            let state = app.state::<AppState>();
            let db = state.db.lock().map_err(|e| e.to_string())?;
            playback_session::read(&db)?
        };
        let session = match payload {
            Some(payload) => serde_json::from_str(&payload).map_err(|e| e.to_string())?,
            None => crate::store::read_value(&app, "mono-player-playback-session")
                .map_err(|e| e.to_string())?
                .and_then(|value| serde_json::from_value(value).ok()),
        };
        Ok(session.map(normalize))
    })())
}

fn normalize(mut session: PlaybackSession) -> PlaybackSession {
    session.queue_tracks = session
        .queue_tracks
        .into_iter()
        .filter_map(normalize_queue_track)
        .collect();
    session.current_track = session.current_track.and_then(normalize_queue_track);
    if let Some(track) = &session.current_track {
        let key = queue_track_source_key(track);
        if !session
            .queue_tracks
            .iter()
            .any(|item| queue_track_source_key(item) == key)
        {
            session.queue_tracks.insert(0, track.clone());
        }
    }
    if session.current_track.is_none() {
        session.current_track = session.queue_tracks.first().cloned();
    }
    if !session.current_time.is_finite() || session.current_time < 0.0 {
        session.current_time = 0.0;
    }
    if !matches!(
        session.playback_mode.as_str(),
        "shuffle" | "fixed" | "repeat"
    ) {
        session.playback_mode = "repeat".into();
    }
    session
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn online_track() -> QueueTrack {
        serde_json::from_value(json!({
            "id": -1, "path": "plugin://provider/song", "title": "Online song",
            "sourceId": "song", "sourceProviderId": "provider", "sourceRaw": {"albumId": "album"}
        }))
        .unwrap()
    }

    #[test]
    fn startup_does_not_clear_saved_session_but_explicit_empty_queue_does() {
        let mut backend = PlayerBackend::default();
        assert!(snapshot(&backend).is_none());
        backend.session_initialized = true;
        let saved = snapshot(&backend).unwrap();
        assert!(saved.queue_tracks.is_empty());
        assert!(saved.current_track.is_none());
    }

    #[test]
    fn online_identity_position_and_mode_survive_round_trip() {
        let mut backend = PlayerBackend::default();
        let track = online_track();
        let source = queue_track_source_key(&track);
        set_queue_backend(
            &mut backend,
            vec![track],
            Some(&source),
            "shuffle".into(),
            false,
            false,
            3000,
        );
        backend.current_source = Some(source.clone());
        backend.session_source = Some(source);
        backend.session_position = 42.5;
        backend.session_initialized = true;
        let payload = serde_json::to_string(&snapshot(&backend).unwrap()).unwrap();
        let restored = normalize(serde_json::from_str(&payload).unwrap());
        assert_eq!(restored.current_time, 42.5);
        assert_eq!(restored.playback_mode, "shuffle");
        let track = restored.current_track.unwrap();
        assert_eq!(track.source_provider_id.as_deref(), Some("provider"));
        assert_eq!(track.source_raw.unwrap()["albumId"], "album");
        assert_eq!(restored.queue_tracks.len(), 1);
        backend.current_source = Some("different-song".into());
        assert_eq!(snapshot(&backend).unwrap().current_time, 0.0);
    }

    #[test]
    fn repairs_missing_current_track_in_queue_and_invalid_position() {
        let restored = normalize(PlaybackSession {
            current_track: Some(online_track()),
            queue_tracks: vec![],
            current_time: f64::NAN,
            playback_mode: "unknown".into(),
        });
        assert_eq!(restored.queue_tracks.len(), 1);
        assert_eq!(restored.current_time, 0.0);
        assert_eq!(restored.playback_mode, "repeat");
    }
}
