use super::authorization::{authorize, Principal};
use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter};

pub(super) fn get(values: &Map<String, Value>, principal: &Principal, params: &Value) -> Result<Value> {
    if !params.as_object().is_some_and(Map::is_empty) {
        return Err(Error::new("INVALID_ARGUMENT", "config.get does not accept parameters"));
    }
    let manifest = values.get("plugins.installed").and_then(Value::as_array)
        .and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
    let mut config = super::super::default_config_from_schema(manifest.and_then(|m| m.get("configSchema")));
    super::super::merge_config_value(&mut config, values.get(&format!("plugins.config.{}", principal.plugin_id)));
    Ok(config)
}

pub(super) fn set(app: &AppHandle, principal: &Principal, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Set { config: Map<String, Value> }
    let params: Set = serde_json::from_value(params.clone())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "Expected config object"))?;
    let config = Value::Object(params.config);
    // Recheck authorization while holding the store lock, so disable/update cannot race a write.
    let resolved = crate::store::update_values(app, |values| {
        if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
            return Ok(Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled")));
        }
        let manifest = values.get("plugins.installed").and_then(Value::as_array)
            .and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
        let grant = values.get("plugins.api.grants").and_then(|v| v.get(&principal.plugin_id));
        if let Err(error) = authorize(principal, manifest, grant, None) { return Ok(Err(error)); }
        let schema = manifest.and_then(|m| m.get("configSchema"));
        let mut resolved = super::super::default_config_from_schema(schema);
        super::super::merge_config_value(&mut resolved, Some(&config));
        if super::super::config::validate_schema(schema, &resolved).is_err() {
            return Ok(Err(Error::new("INVALID_ARGUMENT", "Configuration does not match its schema")));
        }
        values.insert(format!("plugins.config.{}", principal.plugin_id), config.clone());
        Ok(Ok(resolved))
    }).map_err(|_| Error::new("INTERNAL", "Cannot save plugin configuration"))??;
    let _ = app.emit("plugins://config",serde_json::json!({"pluginId":principal.plugin_id}));
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn configuration_is_bound_to_principal_and_uses_defaults() {
        let values = json!({"plugins.installed":[{"id":"one","configSchema":{"fields":[{"key":"size","defaultValue":3}]}}],"plugins.config.one":{"name":"One"},"plugins.config.two":{"secret":"private"}}).as_object().unwrap().clone();
        let principal = Principal { plugin_id:"one".into(),package_revision:"a".into(),surface:"page".into() };
        assert_eq!(get(&values,&principal,&json!({})).unwrap(),json!({"name":"One","size":3}));
        assert_eq!(get(&values,&principal,&json!({"pluginId":"two"})).unwrap_err().code,"INVALID_ARGUMENT");
    }
}
