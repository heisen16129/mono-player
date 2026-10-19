use crate::{
    api_response::ApiResponse, database::library_search, models::LibrarySearchResult,
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub(crate) fn search_library(
    state: State<'_, AppState>,
    query: String,
) -> ApiResponse<LibrarySearchResult> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        library_search::read(&db, &query)
    })())
}
