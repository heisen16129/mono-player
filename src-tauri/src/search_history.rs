use crate::{api_response::ApiResponse, database::search_history, state::AppState};
use tauri::State;

#[tauri::command]
pub(crate) fn update_search_history(
    state: State<'_, AppState>,
    action: String,
    keyword: Option<String>,
    limit: u32,
) -> ApiResponse<Vec<String>> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        search_history::update(&db, &action, keyword.as_deref().unwrap_or(""), limit)
    })())
}
