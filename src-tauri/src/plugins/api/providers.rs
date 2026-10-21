use super::authorization::{authorize, permissions, Principal};
use crate::models::plugin_api::{Error, Result};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

// The playback engine keeps an internal execution plan; installed records remain canonical v1 manifests.
pub(crate) fn playback_plan(values: &serde_json::Map<String, Value>, id: &str) -> Result<crate::plugins::PluginPlaybackPlanPlugin> {
    if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
        return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
    }
    let manifest = values.get("plugins.installed").and_then(Value::as_array)
        .and_then(|items| items.iter().find(|p| p["id"] == id))
        .ok_or_else(|| Error::new("NOT_FOUND", "Playback provider is unavailable"))?;
    let principal = principal(manifest);
    let grant = values.get("plugins.api.grants").and_then(|g| g.get(id));
    authorize(&principal, Some(manifest), grant, None)?;
    let entry = manifest["entry"]["wasm"].as_str().filter(|path| super::manifest::valid_path(path))
        .ok_or_else(|| Error::new("UNSUPPORTED", "Provider requires a v1 WASM entry"))?;
    let root = manifest["packageRoot"].as_str().filter(|root| std::path::Path::new(root).is_absolute())
        .ok_or_else(|| Error::new("INTERNAL", "Provider package is unavailable"))?;
    let capabilities: Vec<String> = serde_json::from_value(manifest["capabilities"].clone())
        .map_err(|_| Error::new("UNSUPPORTED", "Invalid provider capabilities"))?;
    Ok(crate::plugins::PluginPlaybackPlanPlugin {
        id:id.into(), name:manifest["name"].as_str().unwrap_or(id).into(), enabled:true,
        capabilities, entry:Some(std::path::Path::new(root).join(entry).to_string_lossy().into_owned()),
        permissions:Some(permissions(manifest, grant.unwrap())),
        config:Some(super::config::get(values, &principal, &json!({}))?),
        config_schema:manifest.get("configSchema").cloned(),
        package_revision:Some(principal.package_revision),
    })
}

pub(super) fn installed(app: &AppHandle, capability: &str) -> Result<Vec<Value>> {
    let values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL", "Cannot read providers"))?;
    if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
        return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
    }
    Ok(values.get("plugins.installed").and_then(Value::as_array).into_iter().flatten().filter(|manifest| {
        let principal = principal(manifest);
        authorize(&principal, Some(manifest), values.get("plugins.api.grants").and_then(|g| g.get(&principal.plugin_id)), None).is_ok()
            && manifest["capabilities"].as_array().is_some_and(|items| items.iter().any(|item| item == capability))
            && manifest["entry"]["wasm"].is_string()
    }).cloned().collect())
}

fn principal(manifest: &Value) -> Principal {
    Principal { plugin_id: manifest["id"].as_str().unwrap_or_default().into(),
        package_revision: manifest["packageRevision"].as_str().unwrap_or_default().into(), surface:"provider".into() }
}

pub(crate) fn invoke(app: &AppHandle, manifest: &Value, mut request: Value) -> Result<Value> {
    let values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL", "Cannot read provider authorization"))?;
    if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
        return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
    }
    let principal = principal(manifest);
    let current = values.get("plugins.installed").and_then(Value::as_array).and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
    let grant = values.get("plugins.api.grants").and_then(|g| g.get(&principal.plugin_id));
    authorize(&principal, current, grant, None)?;
    let manifest = current.unwrap();
    let relative = manifest["entry"]["wasm"].as_str().filter(|path| super::manifest::valid_path(path))
        .ok_or_else(|| Error::new("UNSUPPORTED", "Provider has no WASM entry"))?;
    let root = manifest["packageRoot"].as_str().ok_or_else(|| Error::new("INTERNAL", "Provider package is unavailable"))?;
    let entry = std::path::Path::new(root).join(relative);
    request["config"] = super::config::get(&values, &principal, &json!({}))?;
    let response = app.state::<crate::workers::plugin::PluginWorkerState>().invoke_plugin(
        entry.to_string_lossy().into_owned(), request, Some(principal.plugin_id), Some(permissions(manifest, grant.unwrap())),
    ).map_err(|_| Error::new("INTERNAL", "Provider operation failed"))?;
    if response["code"] != 1 { return Err(Error::new("INTERNAL", "Provider operation failed")); }
    Ok(response["data"].clone())
}

pub(super) fn list(app: &AppHandle, params: &Value) -> Result<Value> {
    if !params.as_object().is_some_and(|params| params.is_empty()) { return Err(Error::new("INVALID_ARGUMENT", "sources.list does not accept parameters")); }
    Ok(json!(installed(app, "search")?.iter().filter(|p| p["capabilities"].as_array().is_some_and(|c| c.iter().any(|v| v == "play")))
        .map(|p| json!({"id":p["id"],"name":p["name"]})).collect::<Vec<_>>()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_playback_reads_canonical_entries_and_only_granted_permissions() {
        let root = std::env::temp_dir();
        let mut values = json!({
            "plugins.installed":[{"id":"p","name":"Provider","enabled":true,"schemaVersion":1,"apiVersion":1,
                "packageRevision":"v1","packageRoot":root,"entry":{"wasm":"backend/plugin.wasm"},
                "capabilities":["play"],"permissions":["network","storage"]}],
            "plugins.api.grants":{"p":{"packageRevision":"v1","permissions":["network"]}},
            "plugins.config.p":{"quality":"high"}
        }).as_object().unwrap().clone();
        let plan = playback_plan(&values, "p").unwrap();
        assert_eq!(plan.entry.unwrap(), root.join("backend/plugin.wasm").to_string_lossy());
        assert_eq!(plan.permissions.unwrap(), vec!["network"]);
        assert_eq!(plan.config.unwrap()["quality"], "high");
        values["plugins.installed"][0]["entry"] = json!("old.wasm");
        assert_eq!(playback_plan(&values, "p").unwrap_err().code, "UNSUPPORTED");
        values["plugins.installed"][0]["enabled"] = json!(false);
        assert_eq!(playback_plan(&values, "p").unwrap_err().code, "PLUGIN_DISABLED");
    }
}
