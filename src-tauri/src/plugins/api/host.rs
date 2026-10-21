use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};
use super::authorization::Principal;

pub(super) fn environment(app:&AppHandle, principal:&Principal, values:&Map<String,Value>) -> Value {
    let label=principal.surface.strip_prefix("desktop:").unwrap_or("main");
    let dimensions=app.get_webview_window(label).and_then(|window| {
        let size=window.inner_size().ok()?;
        let scale=window.scale_factor().ok()?;
        Some(json!({"width":size.width as f64/scale,"height":size.height as f64/scale}))
    });
    let settings=values.get(crate::settings::KEY);
    json!({"theme":settings.and_then(|s|s["theme"].as_str()).unwrap_or("blueWhite"),
        "locale":settings.and_then(|s|s["locale"].as_str()).unwrap_or("zh-CN"),
        "windowControlsInset":if label=="main" {112} else {0},
        "hasPlayerBar":label=="main", "windowSize":dimensions})
}
