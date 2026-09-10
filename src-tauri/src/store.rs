use crate::{api_response::ApiResponse, app_error::AppResult};
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const STORE_FILE: &str = "mono-player.store.json";

fn plugin_config_key(plugin_id: &str) -> Result<String, String> {
    let plugin_id = plugin_id.trim();
    if plugin_id.is_empty() {
        return Err("plugin id is required".to_string());
    }
    Ok(format!("plugins.config.{plugin_id}"))
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|err| err.to_string())?;
    Ok(app_data_dir.join(STORE_FILE))
}

fn read_store(app: &AppHandle) -> Result<Map<String, Value>, String> {
    let path = store_path(app)?;
    if !path.exists() {
        return Ok(Map::new());
    }

    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    if content.trim().is_empty() {
        return Ok(Map::new());
    }

    match serde_json::from_str::<Value>(&content).map_err(|err| err.to_string())? {
        Value::Object(values) => Ok(values),
        _ => Ok(Map::new()),
    }
}

fn write_store(app: &AppHandle, values: &Map<String, Value>) -> Result<(), String> {
    let path = store_path(app)?;
    let content = serde_json::to_string_pretty(values).map_err(|err| err.to_string())?;
    fs::write(path, content).map_err(|err| err.to_string())
}

pub(crate) fn read_value(app: &AppHandle, key: &str) -> AppResult<Option<Value>> {
    Ok(read_store(app)?.remove(key))
}

pub(crate) fn read_plugin_config_value(
    app: &AppHandle,
    plugin_id: &str,
) -> AppResult<Option<Value>> {
    let key = plugin_config_key(plugin_id)?;
    read_value(app, &key)
}

#[tauri::command]
pub fn store_get(app: AppHandle, key: String) -> ApiResponse<Option<Value>> {
    ApiResponse::from_app_result(read_value(&app, &key))
}

#[tauri::command]
pub fn store_set(app: AppHandle, key: String, value: Value) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let mut values = read_store(&app)?;
        values.insert(key, value);
        write_store(&app, &values)
    })())
}

#[tauri::command]
pub fn store_delete(app: AppHandle, key: String) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let mut values = read_store(&app)?;
        values.remove(&key);
        write_store(&app, &values)
    })())
}

#[tauri::command]
pub fn plugin_config_get(app: AppHandle, plugin_id: String) -> ApiResponse<Option<Value>> {
    ApiResponse::from_app_result(read_plugin_config_value(&app, &plugin_id))
}

#[tauri::command]
pub fn plugin_config_set(app: AppHandle, plugin_id: String, config: Value) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let key = plugin_config_key(&plugin_id)?;
        let mut values = read_store(&app)?;
        if config.as_object().is_some_and(Map::is_empty) {
            values.remove(&key);
        } else {
            values.insert(key, config);
        }
        write_store(&app, &values)
    })())
}
