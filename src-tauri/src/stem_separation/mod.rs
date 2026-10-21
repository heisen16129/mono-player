pub(crate) mod karaoke;
use crate::{api_response::ApiResponse, plugins::services};
use serde_json::{json, Value};
use tauri::AppHandle;
pub(crate) const ID: &str = "mono-wasm-stem-separation";
async fn request(app: AppHandle, id: String, method: &'static str, params: Value) -> ApiResponse<Value> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || services::request(&app, &id, method, params))
        .await.map_err(|e|e.to_string()).and_then(|r|r))
}
#[tauri::command]
pub(crate) async fn stem_environment_check(app: AppHandle, plugin_id: String) -> ApiResponse<Value> { request(app,plugin_id,"checkEnvironment",json!({})).await }
#[tauri::command]
pub(crate) async fn stem_environment_prepare(app: AppHandle, plugin_id: String) -> ApiResponse<Value> { request(app,plugin_id,"prepareEnvironment",json!({})).await }
#[tauri::command]
pub(crate) async fn stem_environment_status(app: AppHandle) -> ApiResponse<Value> { request(app,ID.into(),"getEnvironment",json!({})).await }
#[tauri::command]
pub(crate) async fn stem_environment_cancel(app: AppHandle) -> ApiResponse<Value> { request(app,ID.into(),"cancelEnvironment",json!({})).await }
#[tauri::command]
pub(crate) async fn stem_separation_status(app: AppHandle) -> ApiResponse<Value> { request(app,ID.into(),"getTask",json!({})).await }
#[tauri::command]
pub(crate) async fn stem_separation_cancel(app: AppHandle, job_id: String) -> ApiResponse<Value> {
    request(app,ID.into(),"cancelBatch",json!({"taskId":job_id})).await
}
