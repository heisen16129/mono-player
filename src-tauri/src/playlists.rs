use crate::{
    api_response::ApiResponse,
    database::playlists as repository,
    models::{Track, UserPlaylist},
    state::AppState,
};
use tauri::{AppHandle, Emitter, State};

fn mutate(
    app: &AppHandle,
    state: &AppState,
    action: impl FnOnce(&rusqlite::Connection) -> Result<(), String>,
) -> ApiResponse<Vec<UserPlaylist>> {
    ApiResponse::from_result((|| {
        let result = {
            let mut db = state.db.lock().map_err(|e| e.to_string())?;
            let tx = db.transaction().map_err(|e| e.to_string())?;
            action(&tx)?;
            let result = repository::read_playlists(&tx)?;
            tx.commit().map_err(|e| e.to_string())?;
            result
        };
        let _ = app.emit("playlists-changed", ());
        Ok(result)
    })())
}

#[tauri::command]
pub(crate) fn list_playlists(state: State<'_, AppState>) -> ApiResponse<Vec<UserPlaylist>> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        repository::read_playlists(&db)
    })())
}

#[tauri::command]
pub(crate) fn create_playlist(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    cover: Option<String>,
    tracks: Vec<Track>,
) -> ApiResponse<Vec<UserPlaylist>> {
    mutate(&app, &state, |db| {
        repository::create(db, &name, cover.as_deref(), &tracks).map(|_| ())
    })
}

#[tauri::command]
pub(crate) fn rename_playlist(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> ApiResponse<Vec<UserPlaylist>> {
    mutate(&app, &state, |db| repository::rename(db, &id, &name))
}

#[tauri::command]
pub(crate) fn update_playlist_cover(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cover: Option<String>,
) -> ApiResponse<Vec<UserPlaylist>> {
    mutate(&app, &state, |db| {
        repository::update_cover(db, &id, cover.as_deref())
    })
}

#[tauri::command]
pub(crate) fn delete_playlist(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> ApiResponse<Vec<UserPlaylist>> {
    mutate(&app, &state, |db| repository::delete(db, &id))
}

#[tauri::command]
pub(crate) fn edit_playlist_tracks(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    tracks: Vec<Track>,
    add: bool,
) -> ApiResponse<Vec<UserPlaylist>> {
    mutate(&app, &state, |db| {
        repository::edit_tracks(db, &id, &tracks, add)
    })
}
