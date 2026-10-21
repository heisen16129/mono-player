use crate::{models::Track, state::AppState};
use tauri::{AppHandle, Manager};

pub(crate) fn read_tracks(app: &AppHandle) -> Result<Vec<Track>, String> {
    let state = app.state::<AppState>();
    let db = state.db.lock().map_err(|error| error.to_string())?;
    crate::database::read_tracks(&db)
}
