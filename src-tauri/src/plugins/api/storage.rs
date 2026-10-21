use super::authorization::{authorize, Principal};
use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::AppHandle;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Key { key: String }

fn key(params: &Value) -> Result<String> {
    let key: Key = serde_json::from_value(params.clone())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "Expected storage key"))?;
    if key.key.is_empty() || key.key.len() > 256 || key.key.chars().any(char::is_control) {
        return Err(Error::new("INVALID_ARGUMENT", "Invalid storage key"));
    }
    Ok(key.key)
}

fn apply(values: &mut Map<String, Value>, principal: &Principal, method: &str, params: &Value) -> Result<Value> {
    let namespace = format!("plugins.api.storage.{}", principal.plugin_id);
    let mut data = values.get(&namespace).and_then(Value::as_object).cloned().unwrap_or_default();
    match method {
        "storage.get" => Ok(data.get(&key(params)?).cloned().unwrap_or(Value::Null)),
        "storage.keys" => {
            if !params.as_object().is_some_and(Map::is_empty) {
                return Err(Error::new("INVALID_ARGUMENT", "storage.keys does not accept parameters"));
            }
            Ok(serde_json::json!(data.keys().collect::<Vec<_>>()))
        }
        "storage.set" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Set { key: String, value: Value }
            let set: Set = serde_json::from_value(params.clone())
                .map_err(|_| Error::new("INVALID_ARGUMENT", "Expected key and value"))?;
            let name = key(&serde_json::json!({"key":set.key}))?;
            data.insert(name, set.value);
            if serde_json::to_vec(&data).unwrap().len() > 1024 * 1024 {
                return Err(Error::new("INVALID_ARGUMENT", "Plugin storage exceeds 1 MiB"));
            }
            values.insert(namespace, Value::Object(data));
            Ok(Value::Null)
        }
        "storage.delete" => {
            data.remove(&key(params)?);
            values.insert(namespace, Value::Object(data));
            Ok(Value::Null)
        }
        _ => Err(Error::new("UNSUPPORTED", "Unknown storage method")),
    }
}

pub(super) fn dispatch(app: &AppHandle, principal: &Principal, method: &str, params: &Value) -> Result<Value> {
    if matches!(method, "storage.get" | "storage.keys") {
        let mut values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL", "Cannot read plugin storage"))?;
        return apply(&mut values, principal, method, params);
    }
    crate::store::update_values(app, |values| {
        if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
            return Ok(Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled")));
        }
        let manifest = values.get("plugins.installed").and_then(Value::as_array)
            .and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
        let grant = values.get("plugins.api.grants").and_then(|v| v.get(&principal.plugin_id));
        if let Err(error) = authorize(principal, manifest, grant, Some("storage")) { return Ok(Err(error)); }
        Ok(apply(values, principal, method, params))
    }).map_err(|_| Error::new("INTERNAL", "Cannot access plugin storage"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn isolates_namespaces_and_rejects_extra_parameters_and_oversized_writes() {
        let mut values = Map::new();
        let one = Principal { plugin_id: "one".into(), package_revision: "a".into(), surface: "page".into() };
        let two = Principal { plugin_id: "two".into(), ..one.clone() };
        apply(&mut values, &one, "storage.set", &json!({"key":"size","value":3})).unwrap();
        assert_eq!(apply(&mut values, &two, "storage.get", &json!({"key":"size"})).unwrap(), Value::Null);
        assert!(apply(&mut values, &two, "storage.get", &json!({"key":"size","pluginId":"one"})).is_err());
        assert!(apply(&mut values, &one, "storage.set", &json!({"key":"size","value":"a".repeat(1024*1024)})).is_err());
        assert_eq!(apply(&mut values, &one, "storage.get", &json!({"key":"size"})).unwrap(), 3);
        apply(&mut values, &one, "storage.delete", &json!({"key":"size"})).unwrap();
        assert_eq!(apply(&mut values, &one, "storage.keys", &json!({})).unwrap(), json!([]));
    }
}
