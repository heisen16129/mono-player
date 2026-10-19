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

fn snapshot(values: &Map<String, Value>) -> Value {
    let sources = values.get(SOURCES).and_then(Value::as_object);
    let mut merged = std::collections::BTreeMap::new();
    let mut official = sources.and_then(|s| s.get(OFFICIAL)).cloned().unwrap_or(json!([]));
    let mut lists = vec![official.clone()];
    for sub in subscriptions(values) {
        if let Some(items) = sources.and_then(|s| s.get(sub["id"].as_str().unwrap_or_default())) { lists.push(items.clone()); }
    }
    // Older caches have no source ownership. Keep them until a source refresh establishes it.
    if sources.is_none() { lists.push(values.get("plugins.catalog.cache").cloned().unwrap_or(json!([]))); }
    if let Some(legacy) = sources.and_then(|s| s.get("legacy")) { lists.insert(0, legacy.clone()); }
    for list in lists {
        for item in list.as_array().into_iter().flatten() {
            if let Some(id) = item["id"].as_str() { merged.insert(id.to_owned(), item.clone()); }
        }
    }
    let deleted = values.get("plugins.deleted").cloned().unwrap_or(json!([]));
    let mut catalog: Vec<_> = merged.into_values().filter(|p| !deleted.as_array().is_some_and(|ids| ids.contains(&p["id"]))).collect();
    catalog.sort_by(|a,b| a["name"].as_str().cmp(&b["name"].as_str()).then_with(|| a["id"].as_str().cmp(&b["id"].as_str())));
    let installed = values.get("plugins.installed").and_then(Value::as_array);
    let status = |item: &Value| {
        let current = installed.and_then(|items| items.iter().find(|p| p["id"] == item["id"]));
        match current { None => "available", Some(p) if p["version"] != item["version"] => "update", _ => "installed" }
    };
    for item in &mut catalog { item["managementStatus"] = json!(status(item)); }
    for item in official.as_array_mut().into_iter().flatten() { item["managementStatus"] = json!(status(item)); }
    json!({"subscriptions":subscriptions(values),"catalog":catalog,"official":official,"deletedIds":deleted,"errors":[]})
}

fn read_snapshot(app: &AppHandle) -> Result<Value, String> {
    Ok(snapshot(&crate::store::read_values(app)?))
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
    fn merge_is_stable_and_status_uses_installed_version() {
        let values = json!({"plugins.subscriptions":[{"id":"s"}],"plugins.catalog.sources":{"official-plugin-store":[{"id":"p","name":"P","version":"1"}],"s":[{"id":"p","name":"P","version":"2"},{"id":"hidden","name":"H"}]},"plugins.deleted":["hidden"],"plugins.installed":[{"id":"p","version":"1"}]}).as_object().unwrap().clone();
        let result = snapshot(&values);
        assert_eq!(result["catalog"].as_array().unwrap().len(),1);
        assert_eq!(result["catalog"][0]["version"],"2");
        assert_eq!(result["official"][0]["version"],"1");
    }
    #[test]
    fn legacy_cache_keeps_other_sources_when_one_refreshes() {
        let mut values = json!({"plugins.subscriptions":[{"id":"a","url":"https://a.test"},{"id":"b","url":"https://b.test"}],"plugins.catalog.cache":[{"id":"a-song","name":"A","sourceUrl":"https://a.test"},{"id":"b-song","name":"B","sourceUrl":"https://b.test"}]}).as_object().unwrap().clone();
        ensure_source_cache(&mut values);
        values.get_mut(SOURCES).unwrap()["a"] = json!([]);
        let result = snapshot(&values);
        assert_eq!(result["catalog"].as_array().unwrap().len(), 1);
        assert_eq!(result["catalog"][0]["id"], "b-song");
        // A failed refresh does not write to the cache, so B's last success remains.
        assert_eq!(snapshot(&values)["catalog"], result["catalog"]);
    }

    #[test]
    fn market_statuses_cover_install_update_and_available() {
        let values = json!({"plugins.catalog.sources":{"official-plugin-store":[{"id":"new","version":"1"},{"id":"old","version":"2"},{"id":"same","version":"1"}]},"plugins.installed":[{"id":"old","version":"1"},{"id":"same","version":"1"}]}).as_object().unwrap().clone();
        let result = snapshot(&values);
        let statuses: Map<String, Value> = result["official"].as_array().unwrap().iter().map(|item| (item["id"].as_str().unwrap().into(), item["managementStatus"].clone())).collect();
        assert_eq!(Value::Object(statuses), json!({"new":"available","old":"update","same":"installed"}));
    }

}
