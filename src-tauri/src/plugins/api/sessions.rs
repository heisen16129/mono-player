use super::{authorization::{authorize, Principal}, dispatch};
use crate::models::plugin_api::{response, Error, Request, Result};
use serde_json::Value;
use std::{collections::HashMap, sync::Mutex};
use tauri::{AppHandle, Manager, WebviewWindow};

#[derive(Default)]
pub(crate) struct Sessions(Mutex<HashMap<String, Session>>);

struct Session { owner: String, principal: Principal }

impl Sessions {
    pub(super) fn revoke(&self, invalid:impl Fn(&Principal)->bool) {
        if let Ok(mut sessions)=self.0.lock() { sessions.retain(|_,s|!invalid(&s.principal)); }
    }

    fn insert(&self, owner: &str, principal: Principal) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        self.0.lock().map_err(|_| Error::new("INTERNAL", "Session registry unavailable"))?
            .insert(id.clone(), Session { owner: owner.into(), principal });
        Ok(id)
    }

    fn principal(&self, owner: &str, id: &str) -> Result<Principal> {
        let sessions = self.0.lock().map_err(|_| Error::new("INTERNAL", "Session registry unavailable"))?;
        let session = sessions.get(id).filter(|session| session.owner == owner)
            .ok_or_else(|| Error::new("PERMISSION_DENIED", "Plugin session is unavailable"))?;
        Ok(session.principal.clone())
    }

    fn close(&self, owner: &str, id: &str) -> Result<()> {
        let mut sessions = self.0.lock().map_err(|_| Error::new("INTERNAL", "Session registry unavailable"))?;
        if sessions.get(id).is_some_and(|session| session.owner != owner) {
            return Err(Error::new("PERMISSION_DENIED", "Plugin session belongs to another surface"));
        }
        sessions.remove(id);
        Ok(())
    }
}

// Only the trusted main-window host creates sessions. The opaque session identifier
// stays in the host transport closure and is never transferred to plugin code.
#[tauri::command]
pub(crate) fn plugin_api_open(app: AppHandle, window: WebviewWindow, plugin_id: String, page_id: String, revision: String) -> Result<String> {
    if window.label() != "main" && window.label() != "desktop-playback-card" && window.label() != "desktop-lyrics"
        && window.label() != format!("plugin-desktop-{plugin_id}") {
        return Err(Error::new("PERMISSION_DENIED", "Unsupported host surface"));
    }
    let values = crate::store::read_values(&app).map_err(|_| Error::new("INTERNAL", "Cannot read plugin state"))?;
    if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
        return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
    }
    let manifest = values.get("plugins.installed").and_then(Value::as_array)
        .and_then(|items| items.iter().find(|p| p["id"] == plugin_id))
        .ok_or_else(|| Error::new("PLUGIN_DISABLED", "Plugin is not installed"))?;
    let renderer = page_id == "__renderer";
    let surface = if window.label() != "main" { format!("desktop:{}",window.label()) }
        else if renderer { "renderer".into() } else { "page".into() };
    let principal = Principal { plugin_id: plugin_id.clone(), package_revision: manifest["packageRevision"].as_str().unwrap_or_default().into(), surface };
    if principal.package_revision != revision { return Err(Error::new("CONFLICT", "Plugin changed while the page was loading")); }
    authorize(&principal, Some(manifest), values.get("plugins.api.grants").and_then(|g| g.get(&plugin_id)), None)?;
    if !(renderer && manifest["entry"]["renderer"].is_string()) && !manifest["contributions"]["pages"].as_array().is_some_and(|pages| pages.iter().any(|page| page["id"] == page_id)) {
        return Err(Error::new("NOT_FOUND", "Plugin page is not declared"));
    }
    app.state::<Sessions>().insert(window.label(), principal)
}

#[tauri::command]
pub(crate) async fn plugin_api_presentation(app: AppHandle, window:WebviewWindow, session_id:String, track:Option<crate::models::Track>) -> Result<Value> {
    let principal = app.state::<Sessions>().principal(window.label(), &session_id)?;
    tauri::async_runtime::spawn_blocking(move || {
    let request = |method:&str, params:Value| dispatch(&app,&principal,&Request {
        api_version:1,request_id:"host-presentation".into(),method:method.into(),params
    });
    let info = request("host.getInfo",serde_json::json!({}));
    if info["ok"] != true { return Err(Error::new("PLUGIN_DISABLED","Plugin session is unavailable")); }
    let permissions = info["data"]["grantedPermissions"].as_array().cloned().unwrap_or_default();
    let mut public = if permissions.iter().any(|p|p=="player.read") { track.as_ref().map(super::library::public_track) } else { None };
    if let Some(public) = public.as_mut() {
        public["artist"] = public["artists"].clone();
        if let Some(reference) = public["artworkRef"].as_str().map(str::to_string) {
            let cover = request("artwork.get",serde_json::json!({"artworkRef":reference}));
            if cover["ok"] == true { public["artworkDataUrl"] = cover["data"]["url"].clone(); }
        }
    }
    let queue = request("queue.get",serde_json::json!({}));
    let config = request("config.get",serde_json::json!({}));
    let playback = request("player.getState",serde_json::json!({}));
    let favorite = public.as_ref().map(|track| request("favorites.contains",serde_json::json!({"trackId":track["id"]})));
    let offset = public.as_ref().and_then(|p| p["id"].as_str()).and_then(|id|
        crate::store::read_values(&app).ok().and_then(|v| v.get("lyrics.offsets").and_then(|v|v.get(id)).cloned())).unwrap_or(serde_json::json!(0));
    Ok(serde_json::json!({"track":public,"queue":queue["data"],"config":config["data"],"permissions":permissions,"offset":offset,"playback":playback["data"],"favorite":favorite.and_then(|v|v.get("data").cloned())}))
    }).await.map_err(|_| Error::new("INTERNAL", "Cannot read presentation"))?
}

#[tauri::command]
pub(crate) fn plugin_lyrics_offset(app: AppHandle, window: WebviewWindow, track: crate::models::Track) -> Result<f64> {
    if window.label() != "main" { return Err(Error::new("PERMISSION_DENIED", "Only the lyrics host may read timing")); }
    let values = crate::store::read_values(&app).map_err(|_| Error::new("INTERNAL", "Cannot read timing"))?;
    Ok(values.get("lyrics.offsets").and_then(|v|v.get(super::library::track_id(&track))).and_then(Value::as_f64).unwrap_or(0.0))
}

#[tauri::command]
pub(crate) async fn plugin_api_request(app: AppHandle, window: WebviewWindow, session_id: String, request: Request) -> Value {
    let request_id = request.request_id.clone();
    let owner = window.label().to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        match app.state::<Sessions>().principal(&owner, &session_id) {
            Ok(principal) => dispatch(&app, &principal, &request),
            Err(error) => response(&request.request_id, Err(error)),
        }
    }).await
        .unwrap_or_else(|_| response(&request_id, Err(Error::new("INTERNAL", "Plugin request failed"))))
}

#[tauri::command]
pub(crate) fn plugin_api_close(app: AppHandle, window: WebviewWindow, session_id: String) -> Result<()> {
    let state=app.state::<Sessions>();
    let principal=state.principal(window.label(),&session_id).ok();
    state.close(window.label(), &session_id)?;
    if let Some(principal)=principal {
        let sessions=state.0.lock().map_err(|_|Error::new("INTERNAL","Session registry unavailable"))?;
        let in_use=sessions.values().any(|session|session.principal.plugin_id==principal.plugin_id
            && session.principal.package_revision==principal.package_revision && session.principal.surface==principal.surface);
        if !in_use { app.state::<super::subscriptions::State>().release(&principal); }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn session_is_bound_to_owner_and_disposal_revokes_access() {
        let sessions = Sessions::default();
        let id = sessions.insert("main",Principal{plugin_id:"one".into(),package_revision:"hash".into(),surface:"page".into()}).unwrap();
        assert_eq!(sessions.principal("main",&id).unwrap().plugin_id,"one");
        assert!(sessions.principal("desktop-lyrics",&id).is_err());
        assert!(sessions.close("desktop-lyrics",&id).is_err());
        sessions.close("main",&id).unwrap();
        assert!(sessions.principal("main",&id).is_err());
        assert!(sessions.close("main",&id).is_ok());
    }
}
