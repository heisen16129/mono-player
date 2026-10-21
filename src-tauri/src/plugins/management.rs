use super::*;
use crate::{store, models::plugin_management::{PluginAction, BatchItemResult}};
use tauri::Emitter;
use std::sync::Mutex;
pub(crate) static MUTATION_LOCK: Mutex<()> = Mutex::new(());

// Host UI view only: canonical installation records are never rewritten as this view.
pub(crate) fn manifests(app: &AppHandle) -> Result<Vec<Value>, String> {
    let values = store::read_values(app)?;
    Ok(values.get("plugins.installed").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|value| api::registry::record(value).ok()).map(|mut value| {
            let root = value["packageRoot"].as_str().unwrap().to_string();
            let renderer = value["entry"]["renderer"].as_str().map(str::to_string);
            let service = value["entry"]["service"].as_str().map(str::to_string);
            let entry = renderer.clone().or_else(|| value["entry"]["wasm"].as_str().map(str::to_string)).or_else(|| service.clone()).unwrap_or_default();
            value["runtime"] = json!(if renderer.is_some() { "module" } else if service.is_some() { "node" } else { "wasm" });
            value["entry"] = json!(Path::new(&root).join(entry).to_string_lossy());
            value["sourceUrl"] = json!(Path::new(&root).join("plugin.json").to_string_lossy());
            value["sourceKind"] = json!("local");
            value["updatedAt"] = value["installedAt"].clone();
            value
        }).collect())
}
pub(crate) fn list(app: &AppHandle, with_config: bool) -> Result<Vec<Value>, String> {
    let mut items = manifests(app)?;
    if with_config { for item in &mut items {
        let id = item["id"].as_str().unwrap_or_default();
        item["config"] = crate::store::read_plugin_config_value(app,id).map_err(|e|e.to_string())?.unwrap_or(json!({}));
    } }
    Ok(items)
}
fn execute(app: &AppHandle, request: PluginAction) -> Result<(), String> {
    let _guard = MUTATION_LOCK.lock().map_err(|e|e.to_string())?;
    store::update_values(app, |values| {
        if request.action == "reorder" {
            let ids = request.ids.as_ref().ok_or("Missing order")?;
            let items = values.get_mut("plugins.installed").and_then(Value::as_array_mut).ok_or("No installed plugins")?;
            items.sort_by_key(|p|ids.iter().position(|id|p["id"] == *id).unwrap_or(usize::MAX));
            return Ok(());
        }
        let id = request.id.as_deref().ok_or("Install through the v1 package installer")?;
        let current = values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"]==id)).ok_or("Plugin not installed")?;
        let revision = current["packageRevision"].as_str().ok_or("Plugin must be rebuilt for API v1")?.to_string();
        let enabled = match request.action.as_str() { "enabled" => Some(request.enabled.ok_or("Missing enabled state")?), "uninstall" => None, _ => return Err("Install through the v1 package installer".into()) };
        api::registry::mutate(values,id,&revision,enabled).map_err(|e|e.message)
    })?;
    let _ = super::theme_links::ensure_links(app);
    api::lifecycle::sync(app);
    app.emit("plugins://changed",()).map_err(|e|e.to_string())
}
#[tauri::command]
pub(crate) fn plugin_list(app:AppHandle,with_config:bool,purpose:Option<String>) -> ApiResponse<Vec<Value>> {
    ApiResponse::from_result(list(&app,with_config).map(|mut items| {
        if let Some(purpose) = purpose { items.retain(|p| {
            let has = |c:&str| p["capabilities"].as_array().is_some_and(|items|items.iter().any(|v|v==c));
            match purpose.as_str() { "music-search"=>has("search")&&has("play"), "lyrics-search"=>has("search")&&has("lyrics"), "desktop-lyrics"=>p["enabled"]==true&&has("desktop-lyrics"), _=>false }
        }); } items
    }))
}
#[tauri::command]
pub(crate) async fn plugin_action(app:AppHandle,request:PluginAction) -> ApiResponse<Vec<Value>> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || { execute(&app,request)?;list(&app,true) }).await.map_err(|e|e.to_string()).and_then(|v|v))
}
#[tauri::command]
pub(crate) async fn plugin_batch(app:AppHandle,request_id:String,requests:Vec<PluginAction>) -> ApiResponse<Vec<BatchItemResult>> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || {
        let total=requests.len();
        requests.into_iter().enumerate().map(|(index,request)| {
            let id=request.id.clone().unwrap_or_default(); let result=execute(&app,request);
            let item=BatchItemResult{index,id,success:result.is_ok(),error:result.err()};
            let _=app.emit("plugins://batch",json!({"requestId":request_id,"completed":index+1,"total":total,"result":item}));item
        }).collect()
    }).await.map_err(|e|e.to_string()))
}
