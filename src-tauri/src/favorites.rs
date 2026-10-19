use crate::{
    api_response::ApiResponse,
    database::favorites::{delete_favorite, insert_favorite, read_favorites},
    models::{FavoriteList, Track},
    state::AppState,
};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub(crate) fn list_favorites(state: State<'_, AppState>) -> ApiResponse<FavoriteList> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        read_favorites(&db).map(FavoriteList::from)
    })())
}

#[tauri::command]
pub(crate) fn add_favorite(
    app: AppHandle,
    state: State<'_, AppState>,
    track: Track,
) -> ApiResponse<FavoriteList> {
    ApiResponse::from_result((|| {
        let result = {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            insert_favorite(&db, &track)?;
            read_favorites(&db)?
        };
        let _ = app.emit("favorites-changed", ());
        Ok(FavoriteList::from(result))
    })())
}

#[tauri::command]
pub(crate) fn remove_favorite(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> ApiResponse<FavoriteList> {
    ApiResponse::from_result((|| {
        let result = {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            delete_favorite(&db, id)?;
            read_favorites(&db)?
        };
        let _ = app.emit("favorites-changed", ());
        Ok(FavoriteList::from(result))
    })())
}
