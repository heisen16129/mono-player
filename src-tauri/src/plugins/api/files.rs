use crate::models::plugin_api::{Error, Result};
use super::authorization::Principal;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

pub(super) fn dispatch(app: &AppHandle, principal: &Principal, method: &str, params: &Value) -> Result<Value> {
    let internal = |e: String| Error::new("INTERNAL", &e);
    match method {
        "files.choose" => {
            #[derive(Deserialize)] #[serde(deny_unknown_fields)]
            struct Input { kind: String }
            let input: Input = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected input kind"))?;
            let dialog = app.dialog().file();
            let chosen = match input.kind.as_str() {
                "file" => dialog.blocking_pick_file(), "directory" => dialog.blocking_pick_folder(),
                _ => return Err(Error::new("INVALID_ARGUMENT", "Expected file or directory")),
            };
            let values = crate::store::read_values(app).map_err(|e| internal(e.to_string()))?;
            if !super::lifecycle::active(&values, principal) { return Err(Error::new("PLUGIN_DISABLED", "Plugin instance is no longer active")); }
            super::authorization::authorize(principal,
                values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"]==principal.plugin_id)),
                values.get("plugins.api.grants").and_then(|v|v.get(&principal.plugin_id)), Some("files.choose"))?;
            let Some(chosen) = chosen else { return Ok(Value::Null); };
            let path = chosen.into_path().map_err(|e| internal(e.to_string()))?.canonicalize().map_err(|e| internal(e.to_string()))?;
            // The user-selected path is deliberately disclosed only to an authorized plugin.
            Ok(json!({"reference":path.to_string_lossy(),"name":path.file_name().unwrap_or_default().to_string_lossy(),"kind":input.kind}))
        }
        "files.reveal" => {
            #[derive(Deserialize)] #[serde(deny_unknown_fields)]
            struct Input { path: String }
            let input: Input = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected path"))?;
            let root = app.path().app_data_dir().map_err(|e| internal(e.to_string()))?.join("plugin-data").join(&principal.plugin_id).canonicalize().map_err(|e| internal(e.to_string()))?;
            let target = Path::new(&input.path).canonicalize().map_err(|e| internal(e.to_string()))?;
            if !target.starts_with(&root) { return Err(Error::new("PERMISSION_DENIED", "Resource is outside plugin data")); }
            let mut command = if cfg!(windows) { std::process::Command::new("explorer.exe") }
                else if cfg!(target_os="macos") { std::process::Command::new("open") }
                else { std::process::Command::new("xdg-open") };
            command.arg(if target.is_dir() { target } else { target.parent().unwrap_or(&root).to_path_buf() });
            #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
            command.spawn().map_err(|e| internal(e.to_string()))?;
            Ok(Value::Null)
        }
        _ => Err(Error::new("UNSUPPORTED", "Unknown file method")),
    }
}
