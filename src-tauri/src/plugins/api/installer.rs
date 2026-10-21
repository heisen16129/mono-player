use super::package::{self, Package};
use crate::models::plugin_api::{Error, Result};
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

fn io_error(_: std::io::Error) -> Error { Error::new("INTERNAL", "Cannot access plugin package") }

// Every extraction goes into a new, host-created directory. Never follow an existing
// package directory or overwrite a package that may still be used by a running instance.
fn extract(package: &Package, root: &Path) -> Result<PathBuf> {
    fs::create_dir_all(root).map_err(io_error)?;
    let target = root.join(uuid::Uuid::new_v4().to_string());
    fs::create_dir(&target).map_err(io_error)?;
    let result = (|| {
        for (name, bytes) in &package.files {
            let path = target.join(name);
            if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(io_error)?; }
            fs::write(path, bytes).map_err(io_error)?;
        }
        Ok(target.clone())
    })();
    if result.is_err() { let _ = fs::remove_dir_all(&target); }
    result
}

fn grants(package: &Package, requested: &[String]) -> Result<Value> {
    let mut unique = std::collections::HashSet::new();
    if requested.iter().any(|permission| !package.manifest.permissions.contains(permission) || !unique.insert(permission)) {
        return Err(Error::new("INVALID_ARGUMENT", "Grant must contain unique declared permissions"));
    }
    Ok(json!({"packageRevision":package.revision,"permissions":requested}))
}

fn load(path: &str) -> Result<Package> {
    if !path.to_ascii_lowercase().ends_with(".monoplugin.zip") {
        return Err(Error::new("UNSUPPORTED", "Only .monoplugin.zip API v1 packages can be installed"));
    }
    package::read(fs::File::open(path).map_err(io_error)?, env!("CARGO_PKG_VERSION"))
}

#[tauri::command]
pub(crate) async fn plugin_package_download(app: AppHandle, window: WebviewWindow, url: String) -> Result<String> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED", "Only the plugin manager may download packages")); }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{Read, Write};
        let url = tauri::Url::parse(&url).map_err(|_| Error::new("INVALID_ARGUMENT", "Invalid package URL"))?;
        if !matches!(url.scheme(), "http" | "https") || !url.path().ends_with(".monoplugin.zip") {
            return Err(Error::new("UNSUPPORTED", "Download an API v1 .monoplugin.zip package"));
        }
        let response = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(120)).build()
            .and_then(|client| client.get(url).send()).and_then(|response| response.error_for_status())
            .map_err(|_| Error::new("UNAVAILABLE", "Cannot download plugin package"))?;
        const LIMIT: u64 = 256 * 1024 * 1024;
        let mut bytes = Vec::new();
        response.take(LIMIT + 1).read_to_end(&mut bytes).map_err(io_error)?;
        if bytes.len() as u64 > LIMIT { return Err(Error::new("INVALID_ARGUMENT", "Plugin package exceeds size limit")); }
        package::read(std::io::Cursor::new(&bytes), env!("CARGO_PKG_VERSION"))?;
        let root = app.path().app_cache_dir().map_err(|_| Error::new("INTERNAL", "Cache directory is unavailable"))?.join("plugin-downloads");
        fs::create_dir_all(&root).map_err(io_error)?;
        let path = root.join(format!("{}.monoplugin.zip", uuid::Uuid::new_v4()));
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(io_error)?;
        file.write_all(&bytes).map_err(io_error)?;
        Ok(path.to_string_lossy().into_owned())
    }).await.map_err(|_| Error::new("INTERNAL", "Cannot download plugin package"))?
}

fn commit(values: &mut serde_json::Map<String, Value>, record: Value, grant: Value) -> std::result::Result<(), String> {
    let record = super::registry::record(&record).map_err(|error| error.message)?;
    let id = record["id"].as_str().unwrap().to_owned();
    let mut installed = values.get("plugins.installed").and_then(Value::as_array).cloned().unwrap_or_default();
    if let Some(index) = installed.iter().position(|item| item["id"] == id) {
        let mut replacement = record;
        replacement["enabled"] = json!(installed[index]["enabled"].as_bool().unwrap_or(true));
        installed[index] = replacement;
    } else { installed.push(record); }
    values.insert("plugins.installed".into(), json!(installed));
    let config = values.get(&format!("plugins.config.{id}")).cloned().unwrap_or(json!({}));
    super::super::config::validate(values,&id,&config)?;
    let mut authorized = values.get("plugins.api.grants").and_then(Value::as_object).cloned().unwrap_or_default();
    authorized.insert(id.clone(), grant);
    values.insert("plugins.api.grants".into(), Value::Object(authorized));
    if let Some(deleted) = values.get_mut("plugins.deleted").and_then(Value::as_array_mut) { deleted.retain(|item| item != &id); }
    Ok(())
}

#[tauri::command]
pub(crate) async fn plugin_package_inspect(window: WebviewWindow, path: String) -> Result<Value> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED", "Only the plugin manager may inspect packages")); }
    tauri::async_runtime::spawn_blocking(move || {
        let package = load(&path)?;
        Ok(json!({"manifest":package.manifest,"revision":package.revision}))
    }).await.map_err(|_| Error::new("INTERNAL", "Cannot inspect plugin package"))?
}

#[tauri::command]
pub(crate) async fn plugin_package_install(app: AppHandle, window: WebviewWindow, path: String, revision: String, permissions: Vec<String>) -> Result<Value> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED", "Only the plugin manager may install packages")); }
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = super::super::management::MUTATION_LOCK.lock().map_err(|_| Error::new("INTERNAL", "Plugin manager is unavailable"))?;
        let package = load(&path)?;
        if package.revision != revision { return Err(Error::new("CONFLICT", "Package changed since inspection")); }
        let grant = grants(&package, &permissions)?;
        let root = app.path().app_data_dir().map_err(|_| Error::new("INTERNAL", "Plugin directory is unavailable"))?.join("plugins-v1");
        let target = extract(&package, &root)?;
        if let Some(wasm) = &package.manifest.entry.wasm {
            let metadata = app.state::<crate::workers::plugin::PluginWorkerState>().invoke_plugin(
                target.join(wasm).to_string_lossy().into_owned(), json!({"action":"metadata"}),
                Some(package.manifest.id.clone()), Some(vec![]));
            let valid = metadata.ok().filter(|value|value["code"]==1)
                .and_then(|value|serde_json::from_value::<super::manifest::Manifest>(value["data"].clone()).ok())
                .is_some_and(|manifest|serde_json::to_value(manifest).ok()==serde_json::to_value(&package.manifest).ok());
            if !valid {
                let _ = fs::remove_dir_all(&target);
                return Err(Error::new("INVALID_ARGUMENT","WASM metadata does not match plugin.json"));
            }
        }
        let mut record = serde_json::to_value(&package.manifest).unwrap();
        record["packageRoot"] = json!(target);
        record["packageRevision"] = json!(package.revision);
        record["enabled"] = json!(true);
        record["installedAt"] = json!(chrono::Utc::now().to_rfc3339());
        let committed = crate::store::update_values(&app, |values| {
            commit(values, record.clone(), grant)?;
            record = values["plugins.installed"].as_array().unwrap().iter().find(|item| item["id"] == package.manifest.id).unwrap().clone();
            Ok(())
        });
        if committed.is_err() {
            let _ = fs::remove_dir_all(&target);
            return Err(Error::new("INTERNAL", "Cannot save plugin installation"));
        }
        if record["enabled"] == true && super::super::theme_links::is_theme(&record) {
            if let Ok(theme) = super::super::theme_links::read_theme(&app,&record) {
                let _ = crate::store::update_values(&app,|values| super::super::theme_links::bind(values,&package.manifest.id,theme));
            }
        }
        super::lifecycle::sync(&app);
        let _ = app.emit("plugins://changed", ());
        Ok(record)
    }).await.map_err(|_| Error::new("INTERNAL", "Cannot install plugin package"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn update_preserves_order_disabled_state_and_configuration_but_replaces_grants() {
        let mut values = json!({"plugins.installed":[{"id":"test","enabled":false},{"id":"other"}],
            "plugins.api.grants":{"test":{"permissions":["old"]},"other":{"permissions":["storage"]}},
            "plugins.deleted":["test","other"],"plugins.config.test":{"value":"keep"}}).as_object().unwrap().clone();
        let record = json!({"schemaVersion":1,"apiVersion":1,"minHostVersion":"0.1.0","id":"test",
            "name":"Test","version":"2.0.0","kind":"tool","entry":{"wasm":"backend/plugin.wasm"},
            "capabilities":[],"permissions":[],"packageRoot":std::env::temp_dir().join("new-package"),
            "packageRevision":"b".repeat(64),"enabled":true,"installedAt":"2026-10-20T00:00:00Z"});
        let grant = json!({"packageRevision":"b".repeat(64),"permissions":[]});
        commit(&mut values, record, grant.clone()).unwrap();
        assert_eq!(values["plugins.installed"][0]["enabled"], false);
        assert_eq!(values["plugins.installed"][0]["version"], "2.0.0");
        assert_eq!(values["plugins.installed"][1]["id"], "other");
        assert_eq!(values["plugins.api.grants"]["test"], grant);
        assert_eq!(values["plugins.api.grants"]["other"]["permissions"], json!(["storage"]));
        assert_eq!(values["plugins.deleted"], json!(["other"]));
        assert_eq!(values["plugins.config.test"]["value"], "keep");
    }
    #[test]
    fn permissions_are_not_implicitly_granted_and_cannot_be_added_by_caller() {
        let manifest = serde_json::from_value(json!({"schemaVersion":1,"apiVersion":1,"minHostVersion":"0.1.0","id":"test","name":"Test","version":"1.0.0","kind":"tool","entry":{},"capabilities":[],"permissions":["library.read"]})).unwrap();
        let package = Package { manifest, revision:"revision".into(), files:Default::default() };
        assert_eq!(grants(&package, &[]).unwrap()["permissions"], json!([]));
        assert!(grants(&package, &["library.read".into()]).is_ok());
        assert!(grants(&package, &["player.control".into()]).is_err());
        assert!(grants(&package, &["library.read".into(),"library.read".into()]).is_err());
    }
}
