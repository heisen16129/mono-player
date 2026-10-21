use super::manifest::{self, Manifest};
use crate::models::plugin_api::{Error, Result};
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter, WebviewWindow};

// Installed metadata belongs to the host, not to plugin.json. Keep the canonical
// manifest intact rather than projecting it onto the old string-entry schema.
pub(crate) fn record(value: &Value) -> Result<Value> {
    let mut manifest = value.as_object().cloned()
        .ok_or_else(|| Error::new("INVALID_ARGUMENT", "Invalid installed package"))?;
    let mut metadata = Map::new();
    for key in ["packageRoot", "packageRevision", "enabled", "installedAt"] {
        metadata.insert(key.into(), manifest.remove(key).unwrap_or(Value::Null));
    }
    let parsed: Manifest = serde_json::from_value(Value::Object(manifest))
        .map_err(|_| Error::new("UNSUPPORTED", "Installed plugin must use API v1"))?;
    manifest::validate(&parsed, env!("CARGO_PKG_VERSION"))?;
    let root = metadata["packageRoot"].as_str().unwrap_or_default();
    let revision = metadata["packageRevision"].as_str().unwrap_or_default();
    if !std::path::Path::new(root).is_absolute() || revision.len() != 64
        || !revision.bytes().all(|c| c.is_ascii_hexdigit())
        || !metadata["enabled"].is_boolean()
        || metadata["installedAt"].as_str().is_none_or(|s| chrono::DateTime::parse_from_rfc3339(s).is_err()) {
        return Err(Error::new("INVALID_ARGUMENT", "Invalid installation metadata"));
    }
    let mut value = serde_json::to_value(parsed).unwrap();
    value.as_object_mut().unwrap().extend(metadata);
    Ok(value)
}

#[tauri::command]
pub(crate) fn plugin_package_list(app: AppHandle, window: WebviewWindow) -> Result<Vec<Value>> {
    if window.label() != "main" && !window.label().starts_with("plugin-desktop-") && window.label() != "desktop-playback-card" && window.label() != "desktop-lyrics" {
        return Err(Error::new("PERMISSION_DENIED", "Unsupported plugin host"));
    }
    let values = crate::store::read_values(&app).map_err(|_| Error::new("INTERNAL", "Cannot read installed packages"))?;
    Ok(values.get("plugins.installed").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|value| record(value).ok()).collect())
}

// Retain old records for user data, but never return them as executable packages.
#[tauri::command]
pub(crate) fn plugin_package_incompatible(app: AppHandle, window: WebviewWindow) -> Result<Vec<Value>> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED","Only the plugin manager may inspect incompatible records")); }
    let values = crate::store::read_values(&app).map_err(|_|Error::new("INTERNAL","Cannot read installed packages"))?;
    Ok(values.get("plugins.installed").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|value|record(value).err().map(|error|serde_json::json!({"id":value["id"],"name":value["name"],"reason":error.message}))).collect())
}

pub(crate) fn mutate(values: &mut Map<String, Value>, id: &str, revision: &str, enabled: Option<bool>) -> Result<()> {
    let items = values.get_mut("plugins.installed").and_then(Value::as_array_mut)
        .ok_or_else(|| Error::new("NOT_FOUND", "Plugin is not installed"))?;
    let index = items.iter().position(|item| item["id"] == id)
        .ok_or_else(|| Error::new("NOT_FOUND", "Plugin is not installed"))?;
    match record(&items[index]) {
        Ok(current) if current["packageRevision"] != revision => return Err(Error::new("CONFLICT","Plugin package changed; refresh before modifying it")),
        Err(error) if enabled.is_some() || !revision.is_empty() => return Err(error),
        _ => {}
    }
    if let Some(enabled) = enabled { items[index]["enabled"] = Value::Bool(enabled); }
    else {
        items.remove(index);
        if let Some(grants) = values.get_mut("plugins.api.grants").and_then(Value::as_object_mut) { grants.remove(id); }
        // User configuration and plugin data survive uninstall; grants never do.
    }
    if enabled != Some(true) { super::super::theme_links::unbind(values,id).map_err(|_| Error::new("INTERNAL","Cannot remove plugin theme"))?; }
    Ok(())
}

// Missing enabled means uninstall. Package files are retained until no running
// instance can hold them; revocation is immediate through per-request validation.
#[tauri::command]
pub(crate) async fn plugin_package_change(app: AppHandle, window: WebviewWindow, id: String, revision: String, enabled: Option<bool>) -> Result<()> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED", "Only the plugin manager may change packages")); }
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = super::super::management::MUTATION_LOCK.lock().map_err(|_| Error::new("INTERNAL", "Plugin manager is unavailable"))?;
        let mut failure = None;
        let saved = crate::store::update_values(&app, |values| {
            mutate(values, &id, &revision, enabled).map_err(|error| { let message = error.message.clone(); failure = Some(error); message })
        });
        if saved.is_err() { return Err(failure.unwrap_or_else(|| Error::new("INTERNAL", "Cannot save plugin state"))); }
        let _ = super::super::theme_links::ensure_links(&app);
        super::lifecycle::sync(&app);
        let _ = app.emit("plugins://changed", ());
        Ok(())
    }).await.map_err(|_| Error::new("INTERNAL", "Cannot change plugin state"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn legacy_records_can_only_be_removed_and_keep_user_configuration() {
        let mut values=json!({"plugins.installed":[{"id":"old","entry":"old.wasm","enabled":true}],"plugins.config.old":{"name":"keep"}}).as_object().unwrap().clone();
        assert!(mutate(&mut values,"old","",Some(true)).is_err());
        mutate(&mut values,"old","",None).unwrap();
        assert_eq!(values["plugins.installed"],json!([]));
        assert_eq!(values["plugins.config.old"]["name"],"keep");
    }
    #[test]
    fn canonical_records_keep_entries_and_contributions_and_reject_legacy() {
        let mut value = json!({"schemaVersion":1,"apiVersion":1,"minHostVersion":"0.1.0",
            "id":"example","name":"Example","version":"1.0.0","kind":"tool",
            "entry":{"wasm":"backend/plugin.wasm"},"capabilities":[],"permissions":[],
            "contributions":{"pages":[{"id":"main","title":"Page","entry":"ui/index.html"}],
                "sidebar":[{"id":"open","title":"Open","icon":"plug","pageId":"main"}]},
            "packageRoot":std::env::temp_dir().join("mono-package"),"packageRevision":"a".repeat(64),
            "enabled":false,"installedAt":"2026-10-20T00:00:00Z"});
        let parsed = record(&value).unwrap();
        assert_eq!(parsed["entry"]["wasm"], "backend/plugin.wasm");
        assert_eq!(parsed["contributions"]["sidebar"][0]["pageId"], "main");
        assert_eq!(parsed["enabled"], false);
        let mut values = json!({"plugins.installed":[parsed.clone()],
            "plugins.api.grants":{"example":{"permissions":["storage"]},"other":{"permissions":[]}},
            "plugins.config.example":{"key":"value"},"plugins.api.storage.example":{"key":"value"}}).as_object().unwrap().clone();
        assert_eq!(mutate(&mut values, "example", "stale", Some(true)).unwrap_err().code, "CONFLICT");
        assert_eq!(values["plugins.installed"][0]["enabled"], false);
        mutate(&mut values, "example", &"a".repeat(64), Some(true)).unwrap();
        assert_eq!(values["plugins.installed"][0]["enabled"], true);
        mutate(&mut values, "example", &"a".repeat(64), None).unwrap();
        assert_eq!(values["plugins.installed"], json!([]));
        assert!(values["plugins.api.grants"].get("example").is_none());
        assert!(values["plugins.api.grants"].get("other").is_some());
        assert!(values.contains_key("plugins.config.example"));
        assert!(values.contains_key("plugins.api.storage.example"));
        value["entry"] = json!("legacy.wasm");
        assert!(record(&value).is_err());
        value["entry"] = json!({"wasm":"backend/plugin.wasm"});
        value["packageRoot"] = json!("relative/path");
        assert!(record(&value).is_err());
    }
}
