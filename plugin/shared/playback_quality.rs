use serde_json::Value;

// Only trust quality attached to the selected playback URL, never a request or config default.
pub fn actual_quality(payload: &Value, url: &str) -> Option<String> {
    match payload {
        Value::Object(object) => {
            let matches_url = ["url", "playUrl", "play_url", "src", "path"].iter()
                .any(|key| object.get(*key).and_then(Value::as_str) == Some(url));
            if matches_url {
                for key in ["actualQuality", "quality", "level", "br"] {
                    if let Some(value) = object.get(key) {
                        let text = match value { Value::String(s) => s.trim().to_string(), Value::Number(n) => n.to_string(), _ => continue };
                        if !text.is_empty() { return Some(text); }
                    }
                }
            }
            object.values().find_map(|value| actual_quality(value, url))
        }
        Value::Array(items) => items.iter().find_map(|value| actual_quality(value, url)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn quality_belongs_to_returned_url() {
        assert_eq!(actual_quality(&json!({"data":[{"url":"other","quality":"hires"},{"url":"chosen","quality":"standard"}]}), "chosen").as_deref(), Some("standard"));
        assert_eq!(actual_quality(&json!({"quality":"hires","data":{"url":"chosen"}}), "chosen"), None);
        assert_eq!(actual_quality(&json!({"url":"chosen","br":320}), "chosen").as_deref(), Some("320"));
    }
}
