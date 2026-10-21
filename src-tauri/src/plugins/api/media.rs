use super::{authorization::{authorize, Principal}, providers};
use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use tauri::{AppHandle, Manager};

const LIFETIME: Duration = Duration::from_secs(30 * 60);

#[derive(Clone, PartialEq)]
pub(super) enum Source { File(PathBuf), Remote(String) }

#[derive(Clone)]
pub(super) struct Lease {
    pub source: Source,
    principal: Principal,
    provider: Option<Principal>,
    expires: Instant,
}

impl Lease {
    pub(super) fn check(&self, app: &AppHandle) -> Result<()> {
        if app.state::<State>().stopped.load(Ordering::Acquire) {
            return Err(Error::new("CANCELLED", "Media service stopped"));
        }
        let values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL", "Cannot read media authorization"))?;
        self.check_values(&values)
    }

    fn check_values(&self, values: &serde_json::Map<String, Value>) -> Result<()> {
        if self.expires <= Instant::now() { return Err(Error::new("NOT_FOUND", "Media resource expired")); }
        if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
            return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
        }
        for (principal, permission) in std::iter::once((&self.principal, Some("media.read")))
            .chain(self.provider.as_ref().map(|p| (p, Some("network")))) {
            let manifest = values.get("plugins.installed").and_then(Value::as_array)
                .and_then(|items| items.iter().find(|m| m["id"] == principal.plugin_id));
            authorize(principal, manifest, values.get("plugins.api.grants").and_then(|g| g.get(&principal.plugin_id)), permission)?;
        }
        Ok(())
    }
}

pub(super) type Leases = Arc<Mutex<HashMap<String, Lease>>>;

#[derive(Default)]
pub(crate) struct State {
    host: Mutex<Option<String>>,
    leases: Leases,
    stopped: Arc<AtomicBool>,
}

impl State {
    pub(crate) fn shutdown(&self) {
        self.stopped.store(true, Ordering::Release);
        if let Ok(mut leases) = self.leases.lock() { leases.clear(); }
    }
}

fn same_resource(a: &Lease, b: &Lease) -> bool {
    let identity = |p: &Principal| (p.plugin_id.clone(), p.package_revision.clone());
    identity(&a.principal) == identity(&b.principal)
        && a.provider.as_ref().map(identity) == b.provider.as_ref().map(identity)
        && a.source == b.source && a.expires.saturating_duration_since(Instant::now()) > Duration::from_secs(60)
}

pub(super) fn prepare(app: &AppHandle, principal: &Principal, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Input { track_id: String }
    let input: Input = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected trackId"))?;
    let track = super::library::resolve_in_app(app, &input.track_id)?;
    let (source, provider) = if let Some(id) = &track.source_provider_id {
        let manifest = providers::installed(app, "play")?.into_iter().find(|p| p["id"] == *id)
            .ok_or_else(|| Error::new("NOT_FOUND", "Playback provider is unavailable"))?;
        let data = providers::invoke(app, &manifest, json!({
            "action":"play", "track":track, "includeMetadata":false,
        }))?;
        let url = remote_url(&data)?;
        (Source::Remote(url), Some(Principal { plugin_id: id.clone(),
            package_revision: manifest["packageRevision"].as_str().unwrap_or_default().into(), surface:"provider".into() }))
    } else {
        if track.path.starts_with("http:") || track.path.starts_with("https:") || track.path.starts_with("plugin:") {
            return Err(Error::new("NOT_FOUND", "Track has no playback provider"));
        }
        let path = PathBuf::from(&track.path).canonicalize().map_err(|_| Error::new("NOT_FOUND", "Audio file is unavailable"))?;
        if !path.is_file() { return Err(Error::new("NOT_FOUND", "Audio file is unavailable")); }
        (Source::File(path), None)
    };
    let lease = Lease { source, principal: principal.clone(), provider, expires: Instant::now() + LIFETIME };
    lease.check(app)?;
    let state = app.state::<State>();
    let mut host = state.host.lock().map_err(|_| Error::new("INTERNAL", "Cannot start media service"))?;
    if host.is_none() {
        *host = Some(super::media_http::start(app.clone(), state.leases.clone(), state.stopped.clone())
            .map_err(|_| Error::new("INTERNAL", "Cannot start media service"))?);
    }
    let mut leases = state.leases.lock().map_err(|_| Error::new("INTERNAL", "Cannot issue media resource"))?;
    leases.retain(|_, lease| lease.expires > Instant::now()
        && (lease.principal.plugin_id != principal.plugin_id || lease.principal.package_revision == principal.package_revision));
    if let Some((token, saved)) = leases.iter().find(|(_, saved)| same_resource(saved, &lease)) {
        return Ok(json!({"url":format!("http://{}/media/{token}", host.as_ref().unwrap()),
            "expiresAt":(chrono::Utc::now() + chrono::Duration::seconds(saved.expires.saturating_duration_since(Instant::now()).as_secs() as i64)).to_rfc3339()}));
    }
    // Bound outstanding capabilities without invalidating an actively used resource.
    if leases.values().filter(|l| l.principal.plugin_id == principal.plugin_id).count() >= 128 {
        return Err(Error::new("CONFLICT", "Too many active media resources; wait for expiry"));
    }
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    leases.insert(token.clone(), lease);
    Ok(json!({"url":format!("http://{}/media/{token}", host.as_ref().unwrap()),
        "expiresAt":(chrono::Utc::now() + chrono::Duration::seconds(LIFETIME.as_secs() as i64)).to_rfc3339()}))
}

fn remote_url(data: &Value) -> Result<String> {
    if data["error"].as_str().is_some_and(|e| !e.trim().is_empty()) {
        return Err(Error::new("INTERNAL", "Provider could not prepare audio"));
    }
    let value = data["url"].as_str().filter(|url| url.len() <= 16384)
        .ok_or_else(|| Error::new("INTERNAL", "Provider did not return audio"))?;
    let url = reqwest::Url::parse(value).map_err(|_| Error::new("INTERNAL", "Invalid audio resource"))?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(Error::new("INTERNAL", "Unsupported audio resource"));
    }
    Ok(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_capability_expires_and_tracks_authorization_changes() {
        let principal = Principal { plugin_id:"p".into(),package_revision:"v1".into(),surface:"service".into() };
        let mut values = json!({"plugins.installed":[{"id":"p","packageRevision":"v1","schemaVersion":1,
            "apiVersion":1,"enabled":true,"permissions":["media.read"]}],
            "plugins.api.grants":{"p":{"packageRevision":"v1","permissions":["media.read"]}}}).as_object().unwrap().clone();
        let mut lease = Lease { source:Source::File("private.mp3".into()), principal, provider:None, expires:Instant::now() + LIFETIME };
        assert!(lease.check_values(&values).is_ok());
        values["plugins.installed"][0]["enabled"] = json!(false);
        assert!(lease.check_values(&values).is_err());
        values["plugins.installed"][0]["enabled"] = json!(true);
        values["plugins.api.grants"]["p"]["permissions"] = json!([]);
        assert!(lease.check_values(&values).is_err());
        values["plugins.api.grants"]["p"]["permissions"] = json!(["media.read"]);
        lease.provider = Some(Principal { plugin_id:"missing".into(),package_revision:"v1".into(),surface:"provider".into() });
        assert!(lease.check_values(&values).is_err());
        lease.provider = None;
        lease.expires = Instant::now();
        assert!(lease.check_values(&values).is_err());
    }

    #[test]
    fn provider_cannot_turn_media_into_arbitrary_file_access() {
        for url in ["file:///C:/private.txt", "C:/private.txt", "data:audio/mp3;base64,AAAA", "javascript:alert(1)"] {
            assert!(remote_url(&json!({"url":url})).is_err());
        }
        assert!(remote_url(&json!({"url":"https://audio.test/song?token=private"})).is_ok());
    }

    #[test]
    fn resource_reuse_cannot_cross_plugin_or_package_boundaries() {
        let original = Lease { source:Source::File("audio.mp3".into()),
            principal:Principal { plugin_id:"p".into(),package_revision:"v1".into(),surface:"page".into() },
            provider:None, expires:Instant::now() + LIFETIME };
        let mut next = original.clone();
        assert!(same_resource(&original, &next));
        next.principal.plugin_id = "other".into();
        assert!(!same_resource(&original, &next));
        next.principal = original.principal.clone();
        next.principal.package_revision = "v2".into();
        assert!(!same_resource(&original, &next));
        next = original.clone();
        next.source = Source::File("other.mp3".into());
        assert!(!same_resource(&original, &next));
    }
}
