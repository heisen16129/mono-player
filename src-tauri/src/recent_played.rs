use crate::{api_response::ApiResponse, database::recent_played, models::Track, state::AppState};
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub(crate) fn list_recently_played_tracks(state: State<'_, AppState>) -> ApiResponse<Vec<Track>> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        recent_played::read(&db)
    })())
}

pub(crate) fn record(app: &AppHandle, path: &str) -> Result<(), String> {
    let changed = {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        recent_played::record(&db, path, chrono::Utc::now().timestamp_millis())?
    };
    if changed {
        let _ = app.emit("recently-played-changed", ());
    }
    Ok(())
}
