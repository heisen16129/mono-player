use super::*;
use crate::{custom_themes, models::custom_theme::CustomTheme, store};
use serde_json::Map;

const LINKS: &str = "themes.plugins";
const INSTALLED: &str = "plugins.installed";

pub(super) fn is_theme(plugin: &Value) -> bool {
    plugin["kind"] == "theme" && plugin["capabilities"].as_array().is_some_and(|v| v.iter().any(|c| c == "theme"))
}

fn asset(value: Option<&str>, entry: &str) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() { return None; }
    if value.contains(":") || value.starts_with('/') || value.starts_with('\\') { return Some(value.into()); }
    if let Ok(url) = tauri::Url::parse(entry) {
        if matches!(url.scheme(), "http" | "https") { return url.join(value).ok().map(|v| v.to_string()); }
    }
    Path::new(entry).parent().map(|parent| parent.join(value).to_string_lossy().into_owned())
}

pub(super) fn read_theme(app: &AppHandle, plugin: &Value) -> Result<CustomTheme, String> {
    let id = plugin["id"].as_str().ok_or("插件 ID 无效")?;
    let entry = plugin["entry"].as_str().ok_or("插件入口无效")?;
    let permissions = serde_json::from_value(plugin["permissions"].clone()).ok();
    let raw = app.state::<crate::workers::plugin::PluginWorkerState>()
        .invoke_plugin(entry.into(), json!({"action":"theme"}), Some(id.into()), permissions)
        .and_then(super::unwrap_plugin_response_envelope)?;
    let text = |key: &str| raw[key].as_str().map(str::trim).filter(|s| !s.is_empty()).or_else(|| plugin[key].as_str()).unwrap_or_default().to_owned();
    let id = text("id");
    let mut theme: CustomTheme = serde_json::from_value(json!({
        "id": if id.starts_with("custom:") { id } else { format!("custom:{id}") },
        "name":text("name"), "author":text("author"), "variables":raw["variables"],
        "preview":asset(raw["preview"].as_str(), entry).or_else(|| plugin["icon"].as_str().map(str::to_owned)),
        "background":asset(raw["background"].as_str(), entry), "backgroundOpacity":raw["backgroundOpacity"],
    })).map_err(|e| e.to_string())?;
    theme.validate()?;
    if theme.variables.is_empty() { return Err("主题插件没有返回主题变量".into()); }
    Ok(theme)
}

pub(super) fn bind(values: &mut Map<String, Value>, plugin_id: &str, theme: CustomTheme) -> Result<(), String> {
    let mut links = values.get(LINKS).and_then(Value::as_object).cloned().unwrap_or_default();
    if links.get(&theme.id).and_then(Value::as_str).is_some_and(|owner| owner != plugin_id) {
        return Err("主题 ID 已被其他插件使用".into());
    }
    let old_ids: Vec<_> = links.iter().filter(|(id, owner)| owner.as_str() == Some(plugin_id) && *id != &theme.id).map(|(id, _)| id.clone()).collect();
    let active = values.get(crate::settings::KEY).and_then(|s| s["theme"].as_str()).unwrap_or_default().to_owned();
    for old in &old_ids { custom_themes::remove(values, old)?; links.remove(old); }
    let next_id = theme.id.clone();
    custom_themes::upsert(values, theme, old_ids.contains(&active))?;
    links.insert(next_id, json!(plugin_id));
    values.insert(LINKS.into(), Value::Object(links));
    Ok(())
}

// Record ownership for existing installations before their package is removed.
pub(crate) fn ensure_links(app: &AppHandle) -> Result<(), String> {
    let installed = store::read_value(app, INSTALLED).map_err(|e| e.to_string())?.unwrap_or(json!([]));
    let links = store::read_value(app, LINKS).map_err(|e| e.to_string())?.unwrap_or(json!({}));
    for plugin in installed.as_array().into_iter().flatten().filter(|p| is_theme(p)) {
        let Some(id) = plugin["id"].as_str() else { continue; };
        if links.as_object().is_some_and(|m| m.values().any(|v| v.as_str() == Some(id))) { continue; }
        let theme = match read_theme(app, plugin) {
            Ok(theme) => theme,
            Err(error) => { eprintln!("[theme-links] Cannot read theme plugin {id}: {error}"); continue; }
        };
        store::update_values(app, |values| {
            if values.get(INSTALLED).and_then(Value::as_array).is_some_and(|items| items.contains(plugin)) {
                bind(values, id, theme)?;
            }
            Ok(())
        })?;
    }
    Ok(())
}

fn remove_records(values: &mut Map<String, Value>, plugin_id: &str) -> Result<(), String> {
    let mut links = values.get(LINKS).and_then(Value::as_object).cloned().unwrap_or_default();
    let ids: Vec<_> = links.iter().filter(|(_, v)| v.as_str() == Some(plugin_id)).map(|(id, _)| id.clone()).collect();
    for id in ids { custom_themes::remove(values, &id)?; links.remove(&id); }
    values.insert(LINKS.into(), Value::Object(links));
    for key in [INSTALLED, "plugins.catalog.cache"] {
        if let Some(items) = values.get_mut(key).and_then(Value::as_array_mut) { items.retain(|p| p["id"] != plugin_id); }
    }
    let mut deleted = values.get("plugins.deleted").and_then(Value::as_array).cloned().unwrap_or_default();
    if !deleted.iter().any(|id| id == plugin_id) { deleted.push(json!(plugin_id)); }
    values.insert("plugins.deleted".into(), json!(deleted));
    values.remove(&format!("plugins.config.{plugin_id}"));
    values.remove(&format!("plugins.config.lyrics-renderer.{plugin_id}"));
    Ok(())
}

pub(super) fn remove_package(app: &AppHandle, values: &mut Map<String, Value>, plugin_id: &str) -> Result<(), String> {
    let path = super::plugin_package_dir(app, plugin_id)?;
    if path.is_dir() { fs::remove_dir_all(path).map_err(|e| e.to_string())?; }
    remove_records(values, plugin_id)
}

pub(crate) fn remove_theme_plugin(app: &AppHandle, values: &mut Map<String, Value>, theme_id: &str) -> Result<(), String> {
    let owner = values.get(LINKS).and_then(|v| v.get(theme_id)).and_then(Value::as_str).map(str::to_owned);
    if let Some(owner) = owner {
        if values.get(INSTALLED).and_then(Value::as_array).is_some_and(|plugins| plugins.iter().any(|p| p["id"] == owner && is_theme(p))) {
            remove_package(app, values, &owner)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn theme(id: &str) -> CustomTheme {
        serde_json::from_value(json!({"id":id,"name":"Theme","author":"Author","variables":{"--color":"red"}})).unwrap()
    }
    #[test]
    fn update_can_rename_theme_without_losing_selection() {
        let mut values = Map::new();
        bind(&mut values, "plugin-a", theme("custom:old")).unwrap();
        values.get_mut(crate::settings::KEY).unwrap()["theme"] = json!("custom:old");
        bind(&mut values, "plugin-a", theme("custom:new")).unwrap();
        assert_eq!(values[custom_themes::KEY].as_array().unwrap().len(), 1);
        assert_eq!(values[custom_themes::KEY][0]["id"], "custom:new");
        assert!(values[LINKS].get("custom:old").is_none());
        assert_eq!(values[LINKS]["custom:new"], "plugin-a");
        assert_eq!(values[crate::settings::KEY]["theme"], "custom:new");
    }
    #[test]
    fn duplicate_theme_id_cannot_steal_another_plugins_theme() {
        let mut values = Map::new();
        bind(&mut values, "plugin-a", theme("custom:a")).unwrap();
        let original = values.clone();
        assert!(bind(&mut values, "plugin-b", theme("custom:a")).is_err());
        assert_eq!(values, original);
    }
    #[test]
    fn uninstall_removes_only_owned_theme_and_plugin_records() {
        let mut values = Map::new();
        values.insert(INSTALLED.into(), json!([{"id":"plugin-a"},{"id":"plugin-b"}]));
        values.insert("plugins.catalog.cache".into(), json!([{"id":"plugin-a"},{"id":"plugin-b"}]));
        values.insert("plugins.config.plugin-a".into(), json!({"key":"a"}));
        values.insert("plugins.config.plugin-b".into(), json!({"key":"b"}));
        bind(&mut values, "plugin-a", theme("custom:a")).unwrap();
        bind(&mut values, "plugin-b", theme("custom:b")).unwrap();
        custom_themes::upsert(&mut values, theme("custom:manual"), false).unwrap();
        values.get_mut(crate::settings::KEY).unwrap()["theme"] = json!("custom:a");
        remove_records(&mut values, "plugin-a").unwrap();
        assert_eq!(values[crate::settings::KEY]["theme"], "blueWhite");
        assert_eq!(values[custom_themes::KEY].as_array().unwrap().len(), 2);
        assert_eq!(values[INSTALLED], json!([{"id":"plugin-b"}]));
        assert_eq!(values["plugins.catalog.cache"], json!([{"id":"plugin-b"}]));
        assert!(!values.contains_key("plugins.config.plugin-a"));
        assert!(values.contains_key("plugins.config.plugin-b"));
        remove_records(&mut values, "plugin-a").unwrap();
        assert_eq!(values["plugins.deleted"], json!(["plugin-a"]));
    }
    #[test]
    fn theme_assets_follow_plugin_entry() {
        assert_eq!(asset(Some("images/bg.png"), "https://example.com/theme/plugin.wasm"), Some("https://example.com/theme/images/bg.png".into()));
        assert_eq!(asset(Some("data:image/png;base64,AA"), "plugin.wasm"), Some("data:image/png;base64,AA".into()));
        assert!(asset(Some(" "), "plugin.wasm").is_none());
    }
}
