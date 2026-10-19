use crate::api_response::ApiResponse;
use crate::models::custom_theme::{CustomTheme, ThemeSnapshot};
use serde_json::{Map, Value, json};
use std::collections::HashSet;
use tauri::AppHandle;

pub(crate) const KEY: &str = "mono-player-custom-themes";
const STARTUP_KEY: &str = "mono-player-startup-theme";

impl CustomTheme {
    pub(crate) fn validate(&mut self) -> Result<(), String> {
        self.id = self.id.trim().to_owned();
        self.name = self.name.trim().to_owned();
        self.author = self.author.trim().to_owned();
        if !self.id.starts_with("custom:") || self.id.len() <= 7 || self.name.is_empty() {
            return Err("主题 ID 或名称无效".into());
        }
        if self.variables.iter().any(|(key, _)| !key.starts_with("--") || key.len() <= 2 || key.chars().any(char::is_whitespace)) {
            return Err("主题样式变量名称无效".into());
        }
        if self.background_opacity.is_some_and(|v| !v.is_finite() || !(0.0..=1.0).contains(&v)) {
            return Err("主题背景透明度必须在 0 到 1 之间".into());
        }
        Ok(())
    }
}

fn snapshot(values: &Map<String, Value>) -> ThemeSnapshot {
    let mut seen = HashSet::new();
    let themes: Vec<CustomTheme> = values.get(KEY).and_then(Value::as_array).into_iter().flatten()
        .filter_map(|value| serde_json::from_value::<CustomTheme>(value.clone()).ok())
        .filter_map(|mut theme| { theme.validate().ok()?; seen.insert(theme.id.clone()).then_some(theme) })
        .collect();
    let selected = values.get(crate::settings::KEY).and_then(|s| s.get("theme")).and_then(Value::as_str).unwrap_or("blueWhite");
    let active_theme = if themes.iter().any(|theme| theme.id == selected) { selected } else { "blueWhite" }.to_owned();
    ThemeSnapshot { themes, active_theme }
}

// Whole-settings saves cannot overwrite a selection made through the theme API.
pub(crate) fn preserve_selection(values: &Map<String, Value>, settings: &mut Value) {
    settings["theme"] = json!(snapshot(values).active_theme);
}

fn save_snapshot(values: &mut Map<String, Value>, state: &ThemeSnapshot) -> Result<(), String> {
    values.insert(KEY.into(), serde_json::to_value(&state.themes).map_err(|e| e.to_string())?);
    let mut settings = crate::settings::normalize(values.get(crate::settings::KEY).cloned().unwrap_or(Value::Null));
    settings["theme"] = json!(state.active_theme);
    values.insert(crate::settings::KEY.into(), settings);
    values.insert(STARTUP_KEY.into(), json!(state.active_theme));
    Ok(())
}

pub(crate) fn upsert(values: &mut Map<String, Value>, mut theme: CustomTheme, activate: bool) -> Result<ThemeSnapshot, String> {
    theme.validate()?;
    let mut state = snapshot(values);
    state.themes.retain(|item| item.id != theme.id);
    if activate { state.active_theme = theme.id.clone(); }
    state.themes.insert(0, theme);
    save_snapshot(values, &state)?;
    Ok(state)
}

pub(crate) fn remove(values: &mut Map<String, Value>, id: &str) -> Result<ThemeSnapshot, String> {
    let mut state = snapshot(values);
    state.themes.retain(|theme| theme.id != id);
    if state.active_theme == id { state.active_theme = "blueWhite".into(); }
    save_snapshot(values, &state)?;
    Ok(state)
}

fn select(values: &mut Map<String, Value>, id: &str) -> Result<ThemeSnapshot, String> {
    let mut state = snapshot(values);
    if id != "blueWhite" && !state.themes.iter().any(|theme| theme.id == id) {
        return Err("主题不存在，请重新选择".into());
    }
    state.active_theme = id.into();
    save_snapshot(values, &state)?;
    Ok(state)
}

#[tauri::command]
pub(crate) fn theme_list(app: AppHandle) -> ApiResponse<ThemeSnapshot> {
    ApiResponse::from_result((|| {
        crate::plugins::theme_links::ensure_links(&app)?;
        crate::store::update_values(&app, |values| {
            let state = snapshot(values);
            save_snapshot(values, &state)?;
            Ok(state)
        })
    })())
}

#[tauri::command]
pub(crate) fn theme_upsert(app: AppHandle, theme: CustomTheme, activate: bool) -> ApiResponse<ThemeSnapshot> {
    ApiResponse::from_result(crate::store::update_values(&app, |values| upsert(values, theme, activate)))
}

#[tauri::command]
pub(crate) fn theme_remove(app: AppHandle, id: String) -> ApiResponse<ThemeSnapshot> {
    ApiResponse::from_result((|| {
        crate::plugins::theme_links::ensure_links(&app)?;
        crate::store::update_values(&app, |values| {
            crate::plugins::theme_links::remove_theme_plugin(&app, values, &id)?;
            remove(values, &id)
        })
    })())
}

#[tauri::command]
pub(crate) fn theme_select(app: AppHandle, id: String) -> ApiResponse<ThemeSnapshot> {
    ApiResponse::from_result(crate::store::update_values(&app, |values| select(values, &id)))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn theme(id: &str) -> CustomTheme {
        serde_json::from_value(json!({"id":id,"name":"Theme","author":"Author","variables":{"--color":"red"}})).unwrap()
    }
    #[test]
    fn replacing_and_deleting_active_theme_preserves_other_settings() {
        let mut values = Map::new();
        values.insert(crate::settings::KEY.into(), json!({"locale":"en-US"}));
        upsert(&mut values, theme("custom:a"), true).unwrap();
        upsert(&mut values, theme("custom:b"), false).unwrap();
        let mut replacement = theme("custom:a"); replacement.name = "Updated".into();
        let state = upsert(&mut values, replacement, false).unwrap();
        assert_eq!(state.themes.len(), 2);
        assert_eq!(state.themes[0].name, "Updated");
        assert_eq!(state.active_theme, "custom:a");
        remove(&mut values, "custom:b").unwrap();
        assert_eq!(snapshot(&values).active_theme, "custom:a");
        remove(&mut values, "custom:a").unwrap();
        assert!(snapshot(&values).themes.is_empty());
        assert_eq!(values[crate::settings::KEY]["theme"], "blueWhite");
        assert_eq!(values[STARTUP_KEY], "blueWhite");
        assert_eq!(values[crate::settings::KEY]["locale"], "en-US");
    }
    #[test]
    fn invalid_updates_and_unknown_selection_do_not_mutate_store() {
        let mut values = Map::new();
        for invalid in [theme("invalid"), CustomTheme { background_opacity: Some(2.0), ..theme("custom:a") }] {
            assert!(upsert(&mut values, invalid, true).is_err());
            assert!(values.is_empty());
        }
        assert!(select(&mut values, "custom:missing").is_err());
        assert!(values.is_empty());
    }
    #[test]
    fn legacy_data_and_stale_settings_keep_valid_selection() {
        let mut values = Map::new();
        values.insert(KEY.into(), json!([null, {"id":"bad"}]));
        values.insert(crate::settings::KEY.into(), json!({"theme":"custom:missing"}));
        assert_eq!(snapshot(&values).active_theme, "blueWhite");
        upsert(&mut values, theme("custom:a"), true).unwrap();
        let mut stale = json!({"theme":"blueWhite", "locale":"en-US"});
        preserve_selection(&values, &mut stale);
        assert_eq!(stale["theme"], "custom:a");
        assert_eq!(stale["locale"], "en-US");
    }
}
