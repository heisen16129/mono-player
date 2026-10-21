use super::{authorization::Principal, library};
use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

pub(super) fn dispatch(app: &AppHandle, principal: &Principal, method: &str, params: &Value) -> Result<Value> {
    let invalid = || Error::new("INVALID_ARGUMENT", "Invalid UI request");
    let payload = match method {
        "ui.notify" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Input { message: String }
            let input: Input = serde_json::from_value(params.clone()).map_err(|_| invalid())?;
            if input.message.trim().is_empty() || input.message.len() > 2000 { return Err(invalid()); }
            json!({"message":input.message})
        }
        "ui.openPage" => {
            #[derive(Deserialize)]
            #[serde(rename_all="camelCase", deny_unknown_fields)]
            struct Input { page_id: String, surface: Option<String> }
            let input: Input = serde_json::from_value(params.clone()).map_err(|_| invalid())?;
            if input.surface.as_deref().is_some_and(|s| !matches!(s,"page"|"desktop")) { return Err(invalid()); }
            let values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL","Cannot read pages"))?;
            let manifest = values.get("plugins.installed").and_then(Value::as_array)
                .and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
            let renderer = input.page_id == "renderer" && manifest.is_some_and(|m| m["entry"]["renderer"].is_string());
            if !renderer && !manifest.is_some_and(|m| m["contributions"]["pages"].as_array()
                .is_some_and(|pages| pages.iter().any(|p| p["id"] == input.page_id))) {
                return Err(Error::new("NOT_FOUND","Plugin page is not declared"));
            }
            json!({"pageId":input.page_id,"surface":input.surface.unwrap_or_else(||"page".into())})
        }
        "lyrics.openSearch" | "lyrics.setOffset" => {
            #[derive(Deserialize)]
            #[serde(rename_all="camelCase", deny_unknown_fields)]
            struct Input { track_id:String, offset:Option<f64> }
            let input: Input = serde_json::from_value(params.clone()).map_err(|_| invalid())?;
            let track = library::resolve_in_app(app,&input.track_id)?;
            if method == "lyrics.setOffset" {
                let offset = input.offset.filter(|v| v.is_finite() && v.abs() <= 600.0).ok_or_else(invalid)?;
                crate::store::update_values(app, |values| {
                    let manifest = values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"]==principal.plugin_id));
                    super::authorization::authorize(principal,manifest,values.get("plugins.api.grants").and_then(|g|g.get(&principal.plugin_id)),Some("lyrics.write")).map_err(|e|e.message)?;
                    let offsets = values.entry("lyrics.offsets").or_insert(json!({}));
                    offsets[&input.track_id] = json!(offset); Ok(())
                }).map_err(|_| Error::new("INTERNAL","Cannot save lyric timing"))?;
            } else if input.offset.is_some() { return Err(invalid()); }
            json!({"trackId":input.track_id,"path":track.path,"offset":input.offset})
        }
        "ui.close" | "ui.openSettings" => {
            if !params.as_object().is_some_and(|p| p.is_empty()) { return Err(invalid()); }
            json!({})
        }
        _ => return Err(Error::new("UNSUPPORTED","Unknown UI operation")),
    };
    app.emit("plugins://ui", json!({"pluginId":principal.plugin_id,"revision":principal.package_revision,
        "method":method,"surface":principal.surface,"params":payload}))
        .map_err(|_| Error::new("INTERNAL","Cannot deliver UI request"))?;
    Ok(Value::Null)
}
