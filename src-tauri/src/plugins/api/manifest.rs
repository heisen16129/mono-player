use crate::models::plugin_api::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Manifest {
    pub schema_version: u32,
    pub api_version: u32,
    pub min_host_version: String,
    pub id: String,
    pub name: String,
    pub version: String,
    pub kind: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    pub entry: Entry,
    pub capabilities: Vec<String>,
    pub permissions: Vec<String>,
    #[serde(default)]
    pub contributions: Contributions,
    pub config_schema: Option<serde_json::Value>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Entry {
    pub wasm: Option<String>,
    pub renderer: Option<String>,
    pub service: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Contributions {
    #[serde(default)]
    pub pages: Vec<Page>,
    #[serde(default)]
    pub commands: Vec<Command>,
    #[serde(default)]
    pub sidebar: Vec<Launcher>,
    #[serde(default)]
    pub playback_bar: Vec<Launcher>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Page { pub id: String, pub title: String, pub entry: String, pub presentation: Option<String> }

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Command { pub id: String, pub title: String }

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Launcher {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub page_id: Option<String>,
    pub command_id: Option<String>,
}

fn invalid(message: &str) -> Error { Error::new("INVALID_ARGUMENT", message) }

pub(crate) fn valid_path(path: &str) -> bool {
    !path.is_empty() && !path.contains(['\\', ':', '\0']) && path.split('/').all(|part| {
        !part.is_empty() && part != "." && part != ".." && !part.ends_with([' ', '.'])
            && !part.chars().any(|c| c.is_control() || "<>\"|?*".contains(c))
            && !matches!(part.split('.').next().unwrap_or_default().to_ascii_uppercase().as_str(),
                "CON" | "PRN" | "AUX" | "NUL" | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9" | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9")
    })
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.'))
        && id != "." && id != ".."
}

pub(crate) fn validate(manifest: &Manifest, host_version: &str) -> Result<()> {
    if manifest.schema_version != 1 || manifest.api_version != 1 { return Err(Error::new("UNSUPPORTED", "Only plugin API v1 is supported")); }
    let minimum = semver::Version::parse(&manifest.min_host_version).map_err(|_| invalid("Invalid minHostVersion"))?;
    let host = semver::Version::parse(host_version).map_err(|_| Error::new("INTERNAL", "Invalid host version"))?;
    if minimum > host { return Err(Error::new("UNSUPPORTED", "Plugin requires a newer host")); }
    semver::Version::parse(&manifest.version).map_err(|_| invalid("Invalid plugin version"))?;
    if !valid_id(&manifest.id) || !valid_path(&manifest.id) || manifest.name.trim().is_empty() || manifest.kind.trim().is_empty() { return Err(invalid("Invalid plugin identity")); }
    for items in [&manifest.permissions, &manifest.capabilities] {
        let unique: HashSet<_> = items.iter().collect();
        if unique.len() != items.len() || items.iter().any(|v| !valid_id(v)) { return Err(invalid("Invalid or repeated capability/permission")); }
    }
    for permission in &manifest.permissions {
        if permission != "network" && !super::METHODS.iter().any(|(_,required)|*required==Some(permission.as_str())) {
            return Err(invalid("Unknown permission"));
        }
    }
    for path in [&manifest.entry.wasm, &manifest.entry.renderer, &manifest.entry.service].into_iter().flatten() {
        if !valid_path(path) { return Err(invalid("Invalid package entry path")); }
    }
    if manifest.entry.service.is_some() && !manifest.permissions.iter().any(|p| p == "speaker-service" || p == "service.run") {
        return Err(invalid("Managed service requires service.run permission"));
    }
    let mut pages = HashSet::new();
    for page in &manifest.contributions.pages {
        if page.presentation.as_deref().is_some_and(|value| !matches!(value, "page" | "dialog")) {
            return Err(invalid("Invalid page presentation"));
        }
        if !valid_id(&page.id) || !pages.insert(&page.id) || page.title.trim().is_empty() || !valid_path(&page.entry) { return Err(invalid("Invalid or repeated page")); }
    }
    let mut commands = HashSet::new();
    for command in &manifest.contributions.commands {
        if !valid_id(&command.id) || !commands.insert(&command.id) || command.title.trim().is_empty() || manifest.entry.wasm.is_none() { return Err(invalid("Invalid command")); }
    }
    if manifest.entry.wasm.is_none() && manifest.entry.renderer.is_none() && manifest.entry.service.is_none() && pages.is_empty() { return Err(invalid("Plugin has no entry")); }
    for launchers in [&manifest.contributions.sidebar, &manifest.contributions.playback_bar] {
        let mut ids = HashSet::new();
        for launcher in launchers {
            if !valid_id(&launcher.id) || !ids.insert(&launcher.id) || launcher.title.trim().is_empty() || !valid_id(&launcher.icon) { return Err(invalid("Invalid or repeated launcher")); }
            match (&launcher.page_id, &launcher.command_id) {
                (Some(id), None) if pages.contains(id) => {},
                (None, Some(id)) if commands.contains(id) => {},
                _ => return Err(invalid("Launcher must target exactly one declared page or command")),
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn manifest() -> Manifest {
        serde_json::from_value(json!({"schemaVersion":1,"apiVersion":1,"minHostVersion":"0.1.0","id":"speaker","name":"Speaker","version":"2.0.0","kind":"integration","entry":{},"capabilities":["speaker-control"],"permissions":[],"contributions":{"pages":[{"id":"main","title":"Speaker","entry":"ui/index.html"}],"playbackBar":[{"id":"open","title":"Speaker","icon":"speaker","pageId":"main"}]}})).unwrap()
    }
    #[test]
    fn validates_explicit_contributions_without_creating_sidebar() {
        let mut value = manifest();
        assert!(validate(&value, "0.1.0").is_ok());
        assert!(value.contributions.sidebar.is_empty());
        value.contributions.playback_bar[0].page_id = Some("missing".into());
        assert!(validate(&value, "0.1.0").is_err());
        assert!(serde_json::from_value::<Manifest>(json!({"id":"legacy","entry":"module.js"})).is_err());
    }
    #[test]
    fn service_entry_needs_no_wasm_but_still_requires_service_permission() {
        let mut value = manifest();
        value.contributions = Contributions::default();
        value.entry.service = Some("dist/service.mjs".into());
        value.permissions = vec!["speaker-service".into()];
        assert!(value.entry.wasm.is_none());
        assert!(validate(&value, "0.1.0").is_ok());
        value.permissions.clear();
        assert!(validate(&value, "0.1.0").is_err());
    }
    #[test]
    fn validates_page_or_dialog_presentation() {
        let mut value = manifest();
        value.contributions.pages[0].presentation = Some("dialog".into());
        assert!(validate(&value, "0.1.0").is_ok());
        value.contributions.pages[0].presentation = Some("page".into());
        assert!(validate(&value, "0.1.0").is_ok());
        value.contributions.pages[0].presentation = Some("unknown".into());
        assert!(validate(&value, "0.1.0").is_err());
    }
    #[test]
    fn rejects_versions_and_unsafe_paths() {
        let value = manifest();
        assert_eq!(validate(&value,"0.0.9").unwrap_err().code,"UNSUPPORTED");
        for path in ["../file", "/file", "C:/file", "ui\\file", "ui//file", "ui/CON.txt", "ui/foo.", "https://host/file"] { assert!(!valid_path(path),"{path}"); }
        assert!(valid_path("ui/assets/icon.svg"));
    }
}
