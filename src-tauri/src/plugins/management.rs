use super::*;
use crate::store;
use crate::models::plugin_management::{PluginAction, BatchItemResult};
use tauri::Emitter;
use std::sync::Mutex;

pub(crate) static MUTATION_LOCK: Mutex<()> = Mutex::new(());
const INSTALLED: &str = "plugins.installed";

pub(crate) fn manifests(app: &AppHandle) -> Result<Vec<Value>, String> {
    let stored = store::read_value(app, INSTALLED).map_err(|e| e.to_string())?.unwrap_or(json!([]));
    Ok(stored.as_array().into_iter().flatten().filter_map(|v| normalize_plugin_manifest_value(v.clone()))
        .filter_map(|v| serde_json::to_value(v).ok()).collect())
}

pub(crate) fn list(app: &AppHandle, with_config: bool) -> Result<Vec<Value>, String> {
    let mut items = manifests(app)?;
    if with_config {
        for item in &mut items {
            let id = item["id"].as_str().unwrap_or_default();
            let key = if item["kind"] == "lyrics-renderer" { format!("lyrics-renderer.{id}") } else { id.into() };
            item["config"] = crate::store::read_plugin_config_value(app, &key).map_err(|e| e.to_string())?.unwrap_or(json!({}));
        }
    }
    Ok(items)
}

fn local_module(path: &str, now: &str) -> Result<PluginManifest, String> {
    let mut value: Value = serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let kind = value["kind"].as_str().unwrap_or_default();
    if value["runtime"] != "module" || !matches!(kind, "lyrics-renderer" | "desktop-lyrics")
        || !value["capabilities"].as_array().is_some_and(|v| v.iter().any(|c| c == kind)) {
        return Err("manifest 必须声明 module 运行类型及歌词渲染能力".into());
    }
    let entry = value["entry"].as_str().ok_or("manifest 缺少 entry")?;
    if !entry.contains(":") && !Path::new(entry).is_absolute() {
        value["entry"] = json!(Path::new(path).parent().unwrap_or(Path::new(".")).join(entry).to_string_lossy());
    }
    for (key, fallback) in [("version", "0.0.0"), ("author", "Local"), ("description", ""), ("updatedAt", now)] {
        if value.get(key).is_none() { value[key] = json!(fallback); }
    }
    value["sourceUrl"] = json!(path);
    value["sourceKind"] = json!("local");
    value["installedAt"] = json!(now);
    value["enabled"] = json!(true);
    normalize_plugin_manifest_value(value).ok_or("插件 manifest 无效".into())
}

fn commit_install(values: &mut serde_json::Map<String, Value>, manifest: Value, theme: Option<crate::models::custom_theme::CustomTheme>) -> Result<(), String> {
    let id = manifest["id"].as_str().ok_or("插件 ID 无效")?.to_owned();
    if let Some(theme) = theme { super::theme_links::bind(values, &id, theme)?; }
    let mut installed = values.get(INSTALLED).and_then(Value::as_array).cloned().unwrap_or_default();
    installed.retain(|p| p["id"] != id);
    installed.insert(0, manifest);
    values.insert(INSTALLED.into(), json!(installed));
    if let Some(deleted) = values.get_mut("plugins.deleted").and_then(Value::as_array_mut) { deleted.retain(|v| v != &id); }
    Ok(())
}

fn execute(app: &AppHandle, request: PluginAction) -> Result<(), String> {
    let _guard = MUTATION_LOCK.lock().map_err(|e| e.to_string())?;
    let id = match request.action.as_str() {
        "install" | "update" => {
            let now = chrono::Utc::now().to_rfc3339();
            let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
            let manifest = if let Some(path) = request.file_path {
                if path.to_ascii_lowercase().ends_with(".json") { local_module(&path, &now)? }
                else { build_local_plugin_manifest_inner(app, &worker, path, now, true)? }
            } else {
                let item = request.item.ok_or("缺少插件安装信息")?;
                let enabled = if request.action == "update" {
                    manifests(app)?.iter().find(|p| p["id"] == item.id).and_then(|p| p["enabled"].as_bool()).unwrap_or(true)
                } else { true };
                build_plugin_manifest_from_catalog_inner(app, &worker, item, now, enabled)?
            };
            let value = serde_json::to_value(manifest).map_err(|e| e.to_string())?;
            let theme = if super::theme_links::is_theme(&value) { Some(super::theme_links::read_theme(app, &value)?) } else { None };
            let id = value["id"].as_str().unwrap().to_owned();
            store::update_values(app, |values| commit_install(values, value, theme))?;
            id
        }
        "reorder" => {
            let ids = request.ids.ok_or("缺少插件顺序")?;
            store::update_values(app, |values| {
                let items = values.get_mut(INSTALLED).and_then(Value::as_array_mut).ok_or("插件列表为空")?;
                items.sort_by_key(|p| ids.iter().position(|id| p["id"] == *id).unwrap_or(usize::MAX));
                Ok(())
            })?;
            String::new()
        }
        "enabled" => {
            let id = request.id.ok_or("缺少插件 ID")?;
            let enabled = request.enabled.ok_or("缺少启用状态")?;
            store::update_values(app, |values| {
                let plugin = values.get_mut(INSTALLED).and_then(Value::as_array_mut)
                    .and_then(|items| items.iter_mut().find(|p| p["id"] == id)).ok_or("插件未安装")?;
                plugin["enabled"] = json!(enabled);
                Ok(())
            })?;
            id
        }
        "uninstall" => {
            let id = request.id.ok_or("缺少插件 ID")?;
            super::theme_links::ensure_links(app)?;
            store::update_values(app, |values| super::theme_links::remove_package(app, values, &id))?;
            id
        }
        _ => return Err("未知插件操作".into()),
    };
    if id == crate::miot::ID { crate::miot::sync_service(app)?; }
    let _ = app.emit("plugins://changed", ());
    Ok(())
}

#[tauri::command]
pub(crate) fn plugin_list(app: AppHandle, with_config: bool, purpose: Option<String>) -> ApiResponse<Vec<Value>> {
    ApiResponse::from_result((|| {
        let mut items = list(&app, with_config)?;
        if let Some(purpose) = purpose {
            if !matches!(purpose.as_str(), "music-search" | "lyrics-search" | "desktop-lyrics") { return Err("未知插件用途".into()); }
            items.retain(|item| matches_purpose(item, &purpose));
        }
        Ok(items)
    })())
}

#[tauri::command]
pub(crate) async fn plugin_action(app: AppHandle, request: PluginAction) -> ApiResponse<Vec<Value>> {
    let result = tauri::async_runtime::spawn_blocking(move || { execute(&app, request)?; list(&app, true) })
        .await.map_err(|e| e.to_string()).and_then(|r| r);
    ApiResponse::from_result(result)
}

#[tauri::command]
pub(crate) async fn plugin_batch(app: AppHandle, request_id: String, requests: Vec<PluginAction>) -> ApiResponse<Vec<BatchItemResult>> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let total = requests.len();
        let mut results = Vec::new();
        for (index, request) in requests.into_iter().enumerate() {
            let id = request.id.clone().or_else(|| request.item.as_ref().map(|v| v.id.clone())).unwrap_or_default();
            let result = execute(&app, request);
            let item = BatchItemResult { index, id, success: result.is_ok(), error: result.err() };
            let _ = app.emit("plugins://batch", json!({"requestId":request_id,"completed":index+1,"total":total,"result":item}));
            results.push(item);
        }
        results
    }).await.map_err(|e| e.to_string());
    ApiResponse::from_result(result)
}

#[cfg(test)]
mod tests {
    #[test]
    fn purposes_require_matching_capabilities_and_desktop_enabled() {
        let music = serde_json::json!({"capabilities":["search","play"],"enabled":false});
        assert!(super::matches_purpose(&music,"music-search"));
        assert!(!super::matches_purpose(&music,"lyrics-search"));
        let mut desktop = serde_json::json!({"kind":"desktop-lyrics","runtime":"module","enabled":true,"capabilities":["desktop-lyrics"]});
        assert!(super::matches_purpose(&desktop,"desktop-lyrics"));
        desktop["enabled"] = serde_json::json!(false);
        assert!(!super::matches_purpose(&desktop,"desktop-lyrics"));
    }

    use super::*;
    #[test]
    fn install_replaces_only_target_and_keeps_config() {
        let mut values = json!({"plugins.installed":[{"id":"a","version":"1"},{"id":"b"}],"plugins.deleted":["a","z"],"plugins.config.a":{"secret":"keep"}}).as_object().unwrap().clone();
        commit_install(&mut values, json!({"id":"a","version":"2"}), None).unwrap();
        assert_eq!(values[INSTALLED], json!([{"id":"a","version":"2"},{"id":"b"}]));
        assert_eq!(values["plugins.deleted"], json!(["z"]));
        assert_eq!(values["plugins.config.a"]["secret"], "keep");
    }
}

fn matches_purpose(item: &Value, purpose: &str) -> bool {
    let has = |name: &str| item["capabilities"].as_array().is_some_and(|items| items.iter().any(|v| v == name));
    match purpose {
        "music-search" => has("search") && has("play"),
        "lyrics-search" => has("search") && has("lyrics"),
        "desktop-lyrics" => item["enabled"] == true && item["runtime"] == "module" && item["kind"] == "desktop-lyrics" && has("desktop-lyrics"),
        _ => false,
    }
}
