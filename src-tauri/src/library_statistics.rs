use crate::{
    api_response::ApiResponse, database::library_statistics, models::LibraryStatistics,
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub(crate) fn read_library_statistics(
    state: State<'_, AppState>,
    directories: Vec<String>,
    query: String,
    unknown_artist: String,
) -> ApiResponse<LibraryStatistics> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        library_statistics::read(&db, &directories, &query, &unknown_artist)
    })())
}
