use serde_json::{Value, json};

pub(crate) const KEY: &str = "mono-player-settings";

fn color(value: &Value) -> bool {
    value.as_str().is_some_and(|s| s.len() == 7 && s.starts_with('#') && s[1..].bytes().all(|c| c.is_ascii_hexdigit()))
}

fn number(object: &mut Value, key: &str, min: f64, max: f64, fallback: &Value, round: bool) {
    let value = object[key].as_f64().or_else(|| object[key].as_str().and_then(|s| s.parse::<f64>().ok()));
    let value = value.filter(|v| v.is_finite()).unwrap_or_else(|| fallback.as_f64().unwrap());
    let value = (if round { value.round() } else { value }).clamp(min, max);
    object[key] = if round { json!(value as i64) } else { json!(value) };
}

fn choice(object: &mut Value, defaults: &Value, key: &str, allowed: &[&str]) {
    if !object[key].as_str().is_some_and(|s| allowed.contains(&s)) { object[key] = defaults[key].clone(); }
}

pub(crate) fn normalize(input: Value) -> Value {
    let defaults: Value = serde_json::from_str(include_str!("settings/defaults.json")).expect("valid settings defaults");
    let mut result = defaults.clone();
    if let Some(source) = input.as_object() {
        for (key, value) in source { result[key] = value.clone(); }
    }
    for (key, fallback) in defaults.as_object().unwrap() {
        if fallback.is_boolean() && !result[key].is_boolean() { result[key] = fallback.clone(); }
        if fallback.is_string() {
            result[key] = result[key].as_str().map(|s| json!(s.trim())).unwrap_or_else(|| fallback.clone());
        }
    }
    for (key, min, max) in [("sleepTimerMinutes",1.,999.), ("lyricFontSize",14.,34.), ("audioCacheMaxMb",64.,51200.), ("searchHistoryLimit",1.,25.)] {
        number(&mut result, key, min, max, &defaults[key], true);
    }
    for (key, allowed) in [
        ("closeAction", &["exit", "tray"][..]), ("locale", &["system", "zh-CN", "en-US"]),
        ("sleepTimerAction", &["stop", "exit", "finishTrack"]), ("qualityFallback", &["lower", "higher", "none"]),
        ("onlinePlaybackFailureAction", &["pause", "next"]),
    ] { choice(&mut result, &defaults, key, allowed); }
    let theme = result["theme"].as_str().unwrap_or_default();
    if theme != "blueWhite" && !(theme.starts_with("custom:") && theme.len() > 7) { result["theme"] = defaults["theme"].clone(); }
    if !color(&result["lyricFontColor"]) { result["lyricFontColor"] = defaults["lyricFontColor"].clone(); }
    for key in ["lyricHighlightColor", "lyricGlowColor"] { if !color(&result[key]) { result[key] = json!(""); } }
    let mut dirs = Vec::new();
    if let Some(items) = result["musicDirs"].as_array() {
        for path in items.iter().filter_map(Value::as_str).map(str::trim).filter(|s| !s.is_empty()) {
            if !dirs.contains(&path.to_string()) { dirs.push(path.to_string()); }
        }
    }
    let primary = result["musicDir"].as_str().unwrap_or_default();
    if !primary.is_empty() && !dirs.iter().any(|p| p == primary) { dirs.insert(0, primary.into()); }
    result["musicDirs"] = json!(dirs);
    let cache = result["audioCacheDir"].as_str().unwrap_or_default();
    if cache.to_ascii_lowercase().starts_with("file:///") {
        if let Ok(url) = tauri::Url::parse(cache) {
            if let Ok(path) = url.to_file_path() { result["audioCacheDir"] = json!(path.to_string_lossy()); }
        }
    }
    let background_defaults = &defaults["lyricsBackground"];
    let mut background = background_defaults.clone();
    if let Some(values) = result["lyricsBackground"].as_object() {
        for (key, value) in values { if background.get(key).is_some() { background[key] = value.clone(); } }
    }
    for (key, fallback) in background_defaults.as_object().unwrap() {
        if fallback.is_string() { background[key] = background[key].as_str().map(|s| json!(s.trim())).unwrap_or_else(|| fallback.clone()); }
    }
    for (key, allowed) in [("source", &["cover", "color", "media", "wallpaper"][..]), ("colorMode", &["custom", "cover"]), ("mediaKind", &["image", "video"]), ("wallpaperProjectType", &["image", "video", "scene", "web", "application", "unknown"])] {
        choice(&mut background, background_defaults, key, allowed);
    }
    for key in ["color", "coverColor"] { if !color(&background[key]) { background[key] = background_defaults[key].clone(); } }
    for (key, min, max) in [("opacity",0.,1.), ("blur",0.,60.), ("windowOpacity",0.,1.), ("positionX",0.,100.), ("positionY",0.,100.), ("scale",1.,2.8)] {
        number(&mut background, key, min, max, &background_defaults[key], false);
    }
    result["lyricsBackground"] = background;
    let mut shortcuts = defaults["appShortcuts"].clone();
    for key in defaults["appShortcuts"].as_object().unwrap().keys() {
        if let Some(value) = result["appShortcuts"][key].as_str() { shortcuts[key] = json!(value.trim()); }
    }
    result["appShortcuts"] = shortcuts;
    for key in ["playlists", "recentPlayedTrackIds", "lastAddedMusicDir", "lastAddedTrackIds"] { result.as_object_mut().unwrap().remove(key); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_settings_use_defaults_and_are_idempotent() {
        let value = normalize(json!({"musicDir": 42, "musicDirs": null, "locale": "bad", "enablePlugins": "true", "lyricsBackground": false, "appShortcuts": []}));
        assert_eq!(value["musicDir"], "");
        assert_eq!(value["musicDirs"], json!([]));
        assert_eq!(value["locale"], "system");
        assert_eq!(value["enablePlugins"], false);
        assert_eq!(value["lyricsBackground"]["opacity"], 0.72);
        assert_eq!(value["appShortcuts"]["togglePlayback"], "Space");
        assert_eq!(normalize(value.clone()), value);
        assert_eq!(normalize(Value::Null), normalize(json!([])));
    }

    #[test]
    fn settings_numbers_are_clamped_and_integers_stay_integers() {
        let value = normalize(json!({"sleepTimerMinutes": -20, "lyricFontSize": 99, "audioCacheMaxMb": "123.6", "searchHistoryLimit": "NaN", "lyricsBackground": {"opacity": 9, "blur": -1, "scale": "2.3", "positionX": null}}));
        assert_eq!(value["sleepTimerMinutes"].as_u64(), Some(1));
        assert_eq!(value["lyricFontSize"].as_u64(), Some(34));
        assert_eq!(value["audioCacheMaxMb"].as_u64(), Some(124));
        assert_eq!(value["searchHistoryLimit"], 10);
        assert_eq!(value["lyricsBackground"]["opacity"], 1.0);
        assert_eq!(value["lyricsBackground"]["blur"], 0.0);
        assert_eq!(value["lyricsBackground"]["scale"], 2.3);
        assert_eq!(value["lyricsBackground"]["positionX"], 50.0);
    }

    #[test]
    fn settings_validate_colors_choices_and_preserve_other_fields() {
        let value = normalize(json!({"lyricFontColor":"bad", "lyricHighlightColor":"#Ab12eF", "lyricGlowColor":123, "qualityFallback":"bad", "theme":"custom:my-theme", "appShortcuts":{"togglePlayback":"  Ctrl+P  ", "nextTrack":""}, "extensionField":{"value":1}, "playlists":[1], "recentPlayedTrackIds":[1]}));
        assert_eq!(value["lyricFontColor"], "#e31a1a");
        assert_eq!(value["lyricHighlightColor"], "#Ab12eF");
        assert_eq!(value["lyricGlowColor"], "");
        assert_eq!(value["qualityFallback"], "lower");
        assert_eq!(value["theme"], "custom:my-theme");
        assert_eq!(value["appShortcuts"]["togglePlayback"], "Ctrl+P");
        assert_eq!(value["appShortcuts"]["nextTrack"], "");
        assert_eq!(value["extensionField"]["value"], 1);
        assert!(value.get("playlists").is_none());
        assert!(value.get("recentPlayedTrackIds").is_none());
    }

    #[test]
    fn settings_trim_paths_and_remove_obsolete_scan_fields() {
        let value = normalize(json!({"musicDir":" D:/Music ","musicDirs":[" D:/Music ", "", false, "D:/Other", "D:/Music"], "lastAddedTrackIds":[1,"2",null,2.5], "lastAddedMusicDir":"D:/Old", "downloadDir":" D:/Downloads "}));
        assert_eq!(value["musicDirs"], json!(["D:/Music", "D:/Other"]));
        assert!(value.get("lastAddedTrackIds").is_none());
        assert!(value.get("lastAddedMusicDir").is_none());
        assert_eq!(value["downloadDir"], "D:/Downloads");
        #[cfg(windows)]
        assert_eq!(normalize(json!({"audioCacheDir":"file:///D:/Music%20Cache"}))["audioCacheDir"], "D:\\Music Cache");
    }
}
