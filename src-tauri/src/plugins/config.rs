use serde_json::{Map, Value};

pub(crate) fn normalize(value: &Value) -> Value {
    let mut result = Map::new();
    for (key, value) in value.as_object().into_iter().flatten() {
        let key = key.trim();
        if key.is_empty() { continue; }
        let normalized = match value {
            Value::String(v) if !v.trim().is_empty() => Some(Value::String(v.trim().into())),
            Value::Number(_) | Value::Bool(_) => Some(value.clone()),
            Value::Array(items) => {
                let items: Vec<_> = items.iter().filter_map(Value::as_str).map(str::trim).filter(|v| !v.is_empty()).map(|v| Value::String(v.into())).collect();
                (!items.is_empty()).then_some(Value::Array(items))
            }
            _ => None,
        };
        if let Some(value) = normalized { result.insert(key.into(), value); }
    }
    Value::Object(result)
}

pub(crate) fn effective(values: &Map<String, Value>, id: &str) -> Value {
    let manifest_id = id.strip_prefix("lyrics-renderer.").unwrap_or(id);
    let manifest = values.get("plugins.installed").and_then(Value::as_array).and_then(|items| items.iter().find(|p| p["id"] == manifest_id));
    let mut config = super::default_config_from_schema(manifest.and_then(|p| p.get("configSchema")));
    super::merge_config_value(&mut config, values.get(&format!("plugins.config.{id}")));
    normalize(&config)
}

pub(crate) fn validate(values: &Map<String, Value>, id: &str, config: &Value) -> Result<(), String> {
    let mut next = values.clone();
    next.insert(format!("plugins.config.{id}"), config.clone());
    let result = effective(&next, id);
    let manifest_id = id.strip_prefix("lyrics-renderer.").unwrap_or(id);
    let fields = values.get("plugins.installed").and_then(Value::as_array).and_then(|items| items.iter().find(|p| p["id"] == manifest_id)).and_then(|p| p["configSchema"]["fields"].as_array());
    for field in fields.into_iter().flatten() {
        let key = field["key"].as_str().unwrap_or_default();
        let value = &result[key];
        if value.is_null() {
            if field["required"] == true { return Err(format!("{key} 为必填项")); }
            continue;
        }
        let valid = match field["type"].as_str().unwrap_or_default() {
            "number" | "range" => value.as_f64().is_some_and(|v| field["min"].as_f64().is_none_or(|min| v >= min) && field["max"].as_f64().is_none_or(|max| v <= max)),
            "switch" => value.is_boolean(),
            "checkbox" => value.is_array(),
            "select" | "radio" => field["options"].as_array().is_none_or(|options| options.iter().any(|o| o["value"] == *value)),
            "text" | "password" => value.is_string(),
            _ => true,
        };
        if !valid { return Err(format!("{key} 的值不符合插件设置要求")); }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn defaults_normalization_and_validation() {
        let values = json!({"plugins.installed":[{"id":"p","configSchema":{"fields":[{"key":"size","type":"number","min":1,"max":10,"defaultValue":3}]}}],"plugins.config.p":{"name":" x ","bad":{},"enabled":false}}).as_object().unwrap().clone();
        assert_eq!(effective(&values,"p"), json!({"size":3,"name":"x","enabled":false}));
        assert!(validate(&values,"p",&json!({"size":20})).is_err());
        assert!(validate(&values,"p",&json!({})).is_ok());
    }
}
