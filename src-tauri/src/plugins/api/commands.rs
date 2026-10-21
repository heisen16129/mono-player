use crate::models::plugin_api::{Error, Result};
use serde_json::{json, Value};
use tauri::{AppHandle, WebviewWindow};

#[tauri::command]
pub(crate) async fn plugin_command_run(app: AppHandle, window: WebviewWindow, plugin_id: String, revision: String, command_id: String) -> Result<Value> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED", "Only the host may launch commands")); }
    tauri::async_runtime::spawn_blocking(move || {
        let values = crate::store::read_values(&app).map_err(|_| Error::new("INTERNAL", "Cannot read plugins"))?;
        let manifest = values.get("plugins.installed").and_then(Value::as_array)
            .and_then(|items| items.iter().find(|p| p["id"] == plugin_id))
            .ok_or_else(|| Error::new("NOT_FOUND", "Plugin is unavailable"))?;
        if manifest["packageRevision"] != revision { return Err(Error::new("CONFLICT", "Plugin has changed")); }
        if !manifest["contributions"]["commands"].as_array().is_some_and(|items| items.iter().any(|c| c["id"] == command_id)) {
            return Err(Error::new("NOT_FOUND", "Command is not declared"));
        }
        super::providers::invoke(&app, manifest, json!({"action":"command","commandId":command_id}))
    }).await.map_err(|_| Error::new("INTERNAL", "Plugin command failed"))?
}
