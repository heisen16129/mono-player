use crate::{api_response::ApiResponse, app_error::AppResult};
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

static STORE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

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

pub(crate) fn read_values(app: &AppHandle) -> Result<Map<String, Value>, String> {
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    read_store(app)
}

pub(crate) fn update_values<T>(app: &AppHandle, update: impl FnOnce(&mut Map<String, Value>) -> Result<T, String>) -> Result<T, String> {
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    let mut values = read_store(app)?;
    let result = update(&mut values)?;
    write_store(app, &values)?;
    Ok(result)
}

fn remove_legacy_playlists(values: &mut Map<String, Value>) -> bool {
    values
        .get_mut("mono-player-settings")
        .and_then(Value::as_object_mut)
        .and_then(|settings| settings.remove("playlists"))
        .is_some()
}

pub(crate) fn clear_legacy_playlists(app: &AppHandle) -> Result<(), String> {
    let mut values = read_store(app)?;
    if remove_legacy_playlists(&mut values) {
        write_store(app, &values)?;
    }
    Ok(())
}

pub(crate) fn read_value(app: &AppHandle, key: &str) -> AppResult<Option<Value>> {
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    let value = read_store(app)?.remove(key);
    if key == crate::settings::KEY {
        let mut settings = crate::settings::normalize(value.unwrap_or(Value::Null));
        let mut values = Map::new();
        values.insert(key.into(), settings.clone());
        crate::library_directories::apply_settings(app, &values, &mut settings)?;
        Ok(Some(settings))
    } else { Ok(value) }
}

pub(crate) fn read_plugin_config_value(
    app: &AppHandle,
    plugin_id: &str,
) -> AppResult<Option<Value>> {
    plugin_config_key(plugin_id)?;
    let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
    Ok(Some(crate::plugins::config::effective(&read_store(app)?, plugin_id.trim())))
}

#[tauri::command]
pub fn store_get(app: AppHandle, key: String) -> ApiResponse<Option<Value>> {
    ApiResponse::from_app_result(read_value(&app, &key))
}

#[tauri::command]
pub fn store_set(app: AppHandle, key: String, value: Value) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
        let mut values = read_store(&app)?;
        let mut value = if key == crate::settings::KEY { crate::settings::normalize(value) } else { value };
        if key == crate::settings::KEY {
            crate::custom_themes::preserve_selection(&values, &mut value);
            crate::library_directories::apply_settings(&app, &values, &mut value)?;
            let previous = crate::settings::normalize(values.get(&key).cloned().unwrap_or(Value::Null));
            if crate::player::cache_settings::changed(&previous, &value) {
                crate::player::cache_settings::apply(&app, &value)?;
            }
        }
        values.insert(key, value);
        write_store(&app, &values)
    })())
}

#[tauri::command]
pub fn plugin_config_get(app: AppHandle, plugin_id: String) -> ApiResponse<Option<Value>> {
    ApiResponse::from_app_result(read_plugin_config_value(&app, &plugin_id))
}

#[tauri::command]
pub fn plugin_config_set(app: AppHandle, plugin_id: String, config: Value) -> ApiResponse<Value> {
    ApiResponse::from_result((|| {
        let key = plugin_config_key(&plugin_id)?;
        let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
        let mut values = read_store(&app)?;
        if !config.is_object() { return Err("插件配置必须是对象".into()); }
        let config = crate::plugins::config::normalize(&config);
        crate::plugins::config::validate(&values, plugin_id.trim(), &config)?;
        if config.as_object().is_some_and(Map::is_empty) {
            values.remove(&key);
        } else {
            values.insert(key, config);
        }
        write_store(&app, &values)?;
        let _ = tauri::Emitter::emit(&app,"plugins://config",serde_json::json!({"pluginId":plugin_id.trim()}));
        Ok(crate::plugins::config::effective(&values, plugin_id.trim()))
    })())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn clears_only_legacy_playlists_and_is_repeatable() {
        let mut values = json!({
            "mono-player-settings": {"playlists": [{"id": "old"}], "volume": 0.5, "musicDirs": ["D:/Music"]},
            "plugins.config.example": {"enabled": true},
            "mono-player-favorites": {"ids": [1]}
        }).as_object().unwrap().clone();
        let mut expected = values.clone();
        expected.get_mut("mono-player-settings").unwrap().as_object_mut().unwrap().remove("playlists");
        assert!(remove_legacy_playlists(&mut values));
        assert_eq!(values, expected);
        assert!(!remove_legacy_playlists(&mut values));
        assert_eq!(values, expected);
    }

    #[test]
    fn absent_settings_are_unchanged_and_null_playlists_are_removed() {
        let mut values = Map::new();
        assert!(!remove_legacy_playlists(&mut values));
        assert!(values.is_empty());
        values.insert("mono-player-settings".into(), json!({"playlists": null}));
        assert!(remove_legacy_playlists(&mut values));
        assert_eq!(values["mono-player-settings"], json!({}));
    }
}

pub(crate) fn migrate_search_history(app: &AppHandle, db: &rusqlite::Connection) -> Result<(), String> {
    let mut values = read_store(app)?;
    let Some(value) = values.remove("search.history") else { return Ok(()); };
    let history: Vec<String> = value.as_array().map(|items| items.iter().filter_map(|item| item.as_str().map(str::to_owned)).collect()).unwrap_or_default();
    crate::database::search_history::import_legacy(db, &history)?;
    write_store(app, &values)
}

pub(crate) fn migrate_download_records(app: &AppHandle, db: &rusqlite::Connection) -> Result<(), String> {
    let mut values = read_store(app)?;
    let Some(value) = values.remove("downloads.items") else { return Ok(()); };
    let items: Vec<crate::models::download_record::DownloadRecord> = serde_json::from_value(value).map_err(|e| e.to_string())?;
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    for item in items {
        if crate::database::download_records::get(&tx, &item.id)?.is_none() {
            crate::database::download_records::save(&tx, &item, None)?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    write_store(app, &values)
}

#[tauri::command]
pub(crate) async fn settings_set(app: AppHandle, value: Value) -> ApiResponse<Value> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = STORE_LOCK.lock().map_err(|e| e.to_string())?;
        let mut normalized = crate::settings::normalize(value);
        let mut values = read_store(&app)?;
        crate::custom_themes::preserve_selection(&values, &mut normalized);
        crate::library_directories::apply_settings(&app, &values, &mut normalized)?;
        let previous = crate::settings::normalize(values.get(crate::settings::KEY).cloned().unwrap_or(Value::Null));
        if crate::player::cache_settings::changed(&previous, &normalized) {
            crate::player::cache_settings::apply(&app, &normalized)?;
        }
        values.insert(crate::settings::KEY.into(), normalized.clone());
        write_store(&app, &values)?;
        drop(_guard);
        crate::plugins::api::lifecycle::sync(&app);
        Ok(normalized)
    }).await.map_err(|e| e.to_string()).and_then(|result| result);
    ApiResponse::from_result(result)
}
