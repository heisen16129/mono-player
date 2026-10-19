use super::{cache::*, normalize_cache_dir_path, PlayerState};
use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager};

pub(crate) fn changed(previous: &Value, next: &Value) -> bool {
    previous["audioCacheDir"] != next["audioCacheDir"]
        || previous["audioCacheMaxMb"] != next["audioCacheMaxMb"]
}

pub(crate) fn apply(app: &AppHandle, settings: &Value) -> Result<(), String> {
    let state = app.state::<PlayerState>();
    let directory = settings["audioCacheDir"].as_str().unwrap_or_default().trim();
    let next = if directory.is_empty() { state.default_cache_dir.clone() }
        else { PathBuf::from(normalize_cache_dir_path(directory)) };
    fs::create_dir_all(&next).map_err(|e| e.to_string())?;
    {
        let mut current = state.cache_dir.lock().map_err(|e| e.to_string())?;
        if *current != next {
            app.state::<crate::workers::audio::AudioWorkerState>()
                .set_cache_dir(online_audio_cache_dir(&next))?;
            *current = next.clone();
        }
    }
    let max_bytes = settings["audioCacheMaxMb"].as_u64().ok_or("Invalid cache limit")? * 1024 * 1024;
    prune_cache_files(&next, &active_cache_paths(), max_bytes);
    let _ = app.emit("cache://changed", ());
    Ok(())
}

pub(crate) fn initialize(app: &AppHandle) -> Result<(), String> {
    let settings = crate::store::read_value(app, crate::settings::KEY)
        .map_err(|e| e.to_string())?.unwrap_or_default();
    apply(app, &settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_cache_changes_require_maintenance() {
        let previous = crate::settings::normalize(json!({}));
        let theme = crate::settings::normalize(json!({"theme":"dark"}));
        assert!(!changed(&previous, &theme));
        assert!(changed(&previous, &crate::settings::normalize(json!({"audioCacheDir":"D:/cache"}))));
        assert!(changed(&previous, &crate::settings::normalize(json!({"audioCacheMaxMb":64}))));
        assert!(!changed(&previous, &crate::settings::normalize(json!({"audioCacheMaxMb":"1024"}))));
    }
}
