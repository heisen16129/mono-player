use super::*;
use serde_json::Map;
const SUBSCRIPTIONS: &str = "plugins.subscriptions";
const SOURCES: &str = "plugins.catalog.sources";
const OFFICIAL: &str = "official-plugin-store";

fn subscriptions(values: &Map<String, Value>) -> Vec<Value> {
    values.get(SUBSCRIPTIONS).and_then(Value::as_array).cloned().unwrap_or_default()
}

fn ensure_source_cache(values: &mut Map<String, Value>) {
    if !values.contains_key(SOURCES) {
        let legacy = values.get("plugins.catalog.cache").cloned().unwrap_or(json!([]));
        let mut cache = Map::new();
        for item in legacy.as_array().into_iter().flatten() {
            let owner = if item["sourceKind"] == "official" { OFFICIAL.to_owned() } else {
                subscriptions(values).iter().find(|s| s["url"] == item["sourceUrl"]).and_then(|s| s["id"].as_str()).unwrap_or("legacy").to_owned()
            };
            cache.entry(owner).or_insert(json!([])).as_array_mut().unwrap().push(item.clone());
        }
        values.insert(SOURCES.into(), Value::Object(cache));
    }
}

fn v1_item(item: &Value) -> bool {
    item["entry"].as_str().is_some_and(|entry| entry.split('?').next().unwrap_or_default().ends_with(".monoplugin.zip"))
}

fn snapshot(values: &Map<String, Value>) -> Value {
    let sources = values.get(SOURCES).and_then(Value::as_object);
    let mut merged = std::collections::BTreeMap::new();
    let mut official = sources.and_then(|s| s.get(OFFICIAL)).cloned().unwrap_or(json!([]));
    if let Some(items) = official.as_array_mut() { items.retain(v1_item); }
    let mut lists = vec![official.clone()];
    for sub in subscriptions(values) {
        if let Some(items) = sources.and_then(|s| s.get(sub["id"].as_str().unwrap_or_default())) { lists.push(items.clone()); }
    }
    // Older caches have no source ownership. Keep them until a source refresh establishes it.
    if sources.is_none() { lists.push(values.get("plugins.catalog.cache").cloned().unwrap_or(json!([]))); }
    if let Some(legacy) = sources.and_then(|s| s.get("legacy")) { lists.insert(0, legacy.clone()); }
    for list in lists {
        for item in list.as_array().into_iter().flatten().filter(|item| v1_item(item)) {
            if let Some(id) = item["id"].as_str() { merged.insert(id.to_owned(), item.clone()); }
        }
    }
    let deleted = values.get("plugins.deleted").cloned().unwrap_or(json!([]));
    let mut catalog: Vec<_> = merged.into_values().filter(|p| !deleted.as_array().is_some_and(|ids| ids.contains(&p["id"]))).collect();
    catalog.sort_by(|a,b| a["name"].as_str().cmp(&b["name"].as_str()).then_with(|| a["id"].as_str().cmp(&b["id"].as_str())));
    let installed = values.get("plugins.installed").and_then(Value::as_array);
    let status = |item: &Value| {
        let current = installed.and_then(|items| items.iter().find(|p| p["id"] == item["id"]));
        match current { None => "available", Some(p) if p["version"] != item["version"] || api::registry::record(p).is_err() => "update", _ => "installed" }
    };
    for item in &mut catalog { item["managementStatus"] = json!(status(item)); }
    for item in official.as_array_mut().into_iter().flatten() { item["managementStatus"] = json!(status(item)); }
    json!({"subscriptions":subscriptions(values),"catalog":catalog,"official":official,"deletedIds":deleted,"errors":[]})
}

fn read_snapshot(app: &AppHandle) -> Result<Value, String> {
    let values = crate::store::read_values(app)?;
    let mut result = snapshot(&values);
    let bundled = bundled(app);
    for key in ["official", "catalog"] {
        let items = result[key].as_array_mut().unwrap();
        for item in &bundled {
            if !items.iter().any(|p| p["id"] == item["id"]) {
                let mut item=item.clone();
                let current=values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"]==item["id"]));
                item["managementStatus"]=json!(match current {None=>"available",Some(p) if p["version"]!=item["version"] || api::registry::record(p).is_err()=>"update",_=>"installed"});
                items.push(item);
            }
        }
    }
    Ok(result)
}

fn bundled(app: &AppHandle) -> Vec<Value> {
    let root = if cfg!(debug_assertions) { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../plugin/dist") }
        else { match app.path().resource_dir() { Ok(root) => root.join("plugin-packages"), Err(_) => return vec![] } };
    let index: Value = match fs::read(root.join("catalog.json")).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()) {
        Some(value) => value, None => return vec![],
    };
    index.as_array().into_iter().flatten().filter_map(|value| {
        let file = value["file"].as_str()?;
        if !api::manifest::valid_path(file) { return None; }
        let package_root = if cfg!(debug_assertions) { root.parent()? } else { root.as_path() };
        let path = package_root.join(file);
        if !path.is_file() { return None; }
        let mut manifest = value.clone();
        manifest.as_object_mut()?.remove("file");
        manifest["packageUrl"] = json!(format!("https://bundled.invalid/{file}"));
        let item = normalize_catalog_item_value(manifest)?;
        let mut item = serde_json::to_value(item).ok()?;
        item["entry"] = json!(path); item["sourceKind"] = json!("official");
        Some(item)
    }).collect()
}

#[tauri::command]
pub(crate) async fn plugin_catalog(app: AppHandle, action: String, id: Option<String>, url: Option<String>) -> ApiResponse<Value> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        if action == "snapshot" { return read_snapshot(&app); }
        let _guard = super::management::MUTATION_LOCK.lock().map_err(|e| e.to_string())?;
        let mut target = id;
        match action.as_str() {
            "add" => {
                let raw = url.ok_or("缺少订阅地址")?;
                let url = tauri::Url::parse(raw.trim()).map_err(|e| e.to_string())?;
                if !matches!(url.scheme(), "http" | "https") { return Err("订阅地址必须是 HTTP 或 HTTPS".into()); }
                target = Some(crate::store::update_values(&app, |values| {
                    ensure_source_cache(values);
                    let mut items = subscriptions(values);
                    if let Some(existing) = items.iter().find(|s| s["url"] == url.as_str()) { return Ok(existing["id"].as_str().unwrap_or_default().to_owned()); }
                    let id = format!("subscription-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default());
                    items.push(json!({"id":id,"name":url.host_str().unwrap_or("订阅"),"url":url.as_str()}));
                    values.insert(SUBSCRIPTIONS.into(), json!(items));
                    Ok(id)
                })?);
            }
            "remove" => {
                let id = target.ok_or("缺少订阅 ID")?;
                return crate::store::update_values(&app, |values| {
                    ensure_source_cache(values);
                    let mut items = subscriptions(values); items.retain(|s| s["id"] != id);
                    values.insert(SUBSCRIPTIONS.into(), json!(items));
                    if let Some(sources) = values.get_mut(SOURCES).and_then(Value::as_object_mut) { sources.remove(&id); }
                    let result = snapshot(values);
                    values.insert("plugins.catalog.cache".into(), result["catalog"].clone());
                    Ok(result)
                });
            }
            "refresh" => {}
            _ => return Err("未知订阅操作".into()),
        }
        let current = read_snapshot(&app)?;
        let mut sources = current["subscriptions"].as_array().cloned().unwrap_or_default();
        sources.insert(0, json!({"id":OFFICIAL,"url":OFFICIAL_PLUGIN_CATALOG_URL}));
        if let Some(id) = target.as_deref() { sources.retain(|s| s["id"] == id); }
        if sources.is_empty() { return Err("订阅不存在".into()); }
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        let mut errors = Vec::new();
        for source in sources {
            let id = source["id"].as_str().unwrap_or_default();
            match fetch_plugin_catalog_items_inner(&worker, source["url"].as_str().unwrap_or_default().into()) {
                Ok(items) => {
                    crate::store::update_values(&app, |values| {
                        if id != OFFICIAL && !subscriptions(values).iter().any(|s| s["id"] == id) { return Ok(()); }
                        ensure_source_cache(values);
                        let cache = values.entry(SOURCES).or_insert(json!({}));
                        cache[id] = json!(items);
                        if id != OFFICIAL {
                            if let Some(deleted) = values.get_mut("plugins.deleted").and_then(Value::as_array_mut) { deleted.retain(|v| !items.iter().any(|p| v == &p.id)); }
                        }
                        let merged = snapshot(values);
                        values.insert("plugins.catalog.cache".into(), merged["catalog"].clone());
                        Ok(())
                    })?;
                }
                Err(error) => errors.push(json!({"id":id,"url":source["url"],"error":error})),
            }
        }
        let mut result = read_snapshot(&app)?;
        result["errors"] = json!(errors);
        Ok(result)
    }).await.map_err(|e| e.to_string()).and_then(|r| r);
    ApiResponse::from_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn v1_catalog_merges_sources_and_rejects_old_executable_entries() {
        let values = json!({"plugins.subscriptions":[{"id":"s"}],"plugins.catalog.sources":{
            "official-plugin-store":[{"id":"p","name":"P","version":"1","entry":"https://a/p.monoplugin.zip"},
              {"id":"legacy","entry":"https://a/old.wasm"}],
            "s":[{"id":"p","name":"P","version":"2","entry":"https://b/p.monoplugin.zip"}]},
            "plugins.installed":[{"id":"p","version":"1"}]}).as_object().unwrap().clone();
        let result = snapshot(&values);
        assert_eq!(result["catalog"].as_array().unwrap().len(),1);
        assert_eq!(result["catalog"][0]["version"],"2");
        assert_eq!(result["catalog"][0]["managementStatus"],"update");
        assert_eq!(result["official"].as_array().unwrap().len(),1);
    }
    #[test]
    fn catalog_requires_canonical_manifest_and_package_url() {
        let mut value: Value = serde_json::from_str(include_str!("../../../plugin/apple-music-lyrics/plugin.json")).unwrap();
        assert!(normalize_catalog_item_value(value.clone()).is_none());
        value["packageUrl"] = json!("https://example.com/apple.monoplugin.zip");
        assert!(normalize_catalog_item_value(value.clone()).is_some());
        value["entry"] = json!("https://example.com/renderer.mjs");
        assert!(normalize_catalog_item_value(value).is_none());
    }
}
