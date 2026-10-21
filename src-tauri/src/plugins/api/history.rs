use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;

pub(super) fn record(app: &AppHandle, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Played { track_id: String }
    let input: Played = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected trackId"))?;
    let track = super::library::resolve_in_app(app, &input.track_id)?;
    crate::recent_played::record(app, &track.path).map_err(|_| Error::new("INTERNAL", "Cannot record playback"))?;
    Ok(Value::Null)
}
