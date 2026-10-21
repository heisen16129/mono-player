mod files;
pub(crate) mod authorization;
pub(crate) mod lifecycle;
pub(crate) mod library;
mod config;
mod host;
mod collections;
mod storage;
mod lyrics;
pub(crate) mod providers;
pub(crate) mod search;
mod history;
mod queue;
mod artwork;
pub(crate) mod media;
mod media_http;
mod player;
mod ui;
pub(crate) mod subscriptions;
pub(crate) mod commands;
pub(crate) mod manifest;
pub(crate) mod package;
pub(crate) mod installer;
pub(crate) mod registry;
pub(crate) mod pages;
pub(crate) mod http;
pub(crate) mod sessions;

use crate::models::plugin_api::{Error, Request, Result};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use authorization::Principal;

pub(crate) const METHODS: &[(&str, Option<&str>)] = &[
    ("host.getInfo", None),
    ("events.subscribe",None), ("events.unsubscribe",None), ("events.poll",None),
    ("audio.subscribeFrames",Some("audio.read")), ("audio.unsubscribeFrames",Some("audio.read")),
    ("library.listArtists",Some("library.read")), ("library.listAlbums",Some("library.read")),
    ("library.listTracks", Some("library.read")),
    ("library.getTrack", Some("library.read")),
    ("library.removeTrack", Some("library.write")),
    ("lyrics.openSearch", Some("lyrics.read")),
    ("lyrics.setOffset", Some("lyrics.write")),
    ("ui.close", None),
    ("ui.notify", None),
    ("ui.openPage", None),
    ("ui.openSettings", None),
    ("config.get", None),
    ("config.set", None),
    ("storage.get", Some("storage")),
    ("storage.set", Some("storage")),
    ("storage.delete", Some("storage")),
    ("storage.keys", Some("storage")),
    ("favorites.list", Some("favorites.read")),
    ("favorites.contains", Some("favorites.read")),
    ("favorites.set", Some("favorites.write")),
    ("playlists.create", Some("playlists.write")),
    ("playlists.update", Some("playlists.write")),
    ("playlists.delete", Some("playlists.write")),
    ("playlists.reorderTracks", Some("playlists.write")),
    ("playlists.list", Some("playlists.read")),
    ("playlists.get", Some("playlists.read")),
    ("playlists.listTracks", Some("playlists.read")),
    ("playlists.addTracks", Some("playlists.write")),
    ("playlists.removeTracks", Some("playlists.write")),
    ("lyrics.parse", None),
    ("lyrics.get", Some("lyrics.read")),
    ("sources.list", Some("sources.search")),
    ("sources.search", Some("sources.search")),
    ("sources.importTracks", Some("sources.import")),
    ("history.recordPlayed", Some("history.write")),
    ("queue.replace", Some("player.control")),
    ("queue.append", Some("player.control")),
    ("queue.insert", Some("player.control")),
    ("queue.remove", Some("player.control")),
    ("queue.reorder", Some("player.control")),
    ("queue.clear", Some("player.control")),
    ("queue.get", Some("player.read")),
    ("queue.play", Some("player.control")),
    ("service.getConnection", Some("service.run")),
    ("files.choose", Some("files.choose")),
    ("files.reveal", Some("files.reveal")),
    ("speaker.getConnection", Some("speaker-service")),
    ("window.startDragging", None),
    ("artwork.get", Some("artwork.read")),
    ("artwork.refresh", Some("artwork.read")),
    ("media.prepare", Some("media.read")),
    ("player.getState", Some("player.read")),
    ("player.playTrack", Some("player.control")),
    ("player.play", Some("player.control")),
    ("player.pause", Some("player.control")),
    ("player.stop", Some("player.control")),
    ("player.next", Some("player.control")),
    ("player.previous", Some("player.control")),
    ("player.seek", Some("player.control")),
    ("player.setVolume", Some("player.control")),
    ("player.setMuted", Some("player.control")),
    ("player.setRate", Some("player.control")),
    ("player.setMode", Some("player.control")),
];

fn surface_allows(principal: &Principal, method: &str) -> bool {
    match method {
        "files.choose" | "files.reveal" | "service.getConnection" => principal.surface == "page",
        "speaker.getConnection" => principal.plugin_id == crate::miot::ID && principal.surface == "page",
        "window.startDragging" => matches!(principal.surface.as_str(),"page"|"renderer") || principal.surface.starts_with("desktop:"),
        _ => true,
    }
}

// Transport adapters must supply a host-bound principal; never accept it in request.params.
pub(crate) fn dispatch(app: &AppHandle, principal: &Principal, request: &Request) -> Value {
    let result = (|| -> Result<Value> {
        if request.api_version != 1 { return Err(Error::new("UNSUPPORTED", "Unsupported plugin API version")); }
        if request.request_id.is_empty() || request.request_id.len() > 128 {
            return Err(Error::new("INVALID_ARGUMENT", "Invalid request ID"));
        }
        if request.method == "host.getInfo" && !request.params.as_object().is_some_and(|params| params.is_empty()) {
            return Err(Error::new("INVALID_ARGUMENT", "host.getInfo does not accept parameters"));
        }
        let permission = METHODS.iter().find(|(method, _)| *method == request.method)
            .ok_or_else(|| Error::new("UNSUPPORTED", "Unknown method"))?.1;
        if !surface_allows(principal, &request.method) { return Err(Error::new("PERMISSION_DENIED", "Method is unavailable on this plugin surface")); }
        let values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL", "Cannot read plugin state"))?;
        if values.get("mono-player-settings").is_some_and(|settings| settings["enablePlugins"] == false) {
            return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
        }
        let installed = values.get("plugins.installed").and_then(Value::as_array)
            .and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
        let grants = values.get("plugins.api.grants").and_then(|value| value.get(&principal.plugin_id));
        authorization::authorize(principal, installed, grants, permission)?;
        match request.method.as_str() {
            "host.getInfo" => Ok(json!({
                "apiVersion": 1,
                "hostVersion": env!("CARGO_PKG_VERSION"),
                "platform": std::env::consts::OS,
                "surface": principal.surface,
                "environment": host::environment(app,principal,&values),
                "methods": METHODS.iter().filter(|(method, p)| surface_allows(principal, method) && authorization::authorize(principal, installed, grants, *p).is_ok()).map(|(m, _)| *m).collect::<Vec<_>>(),
                "grantedPermissions": authorization::permissions(installed.unwrap(), grants.unwrap()),
            })),
            method if method.starts_with("events.") || method.starts_with("audio.") => subscriptions::dispatch(app,principal,method,&request.params),
            method @ ("library.listArtists"|"library.listAlbums") => library::groups(app,method,&request.params),
            "library.listTracks" => library::list(app, &request.params),
            "library.getTrack" => library::get(app, &request.params),
            "library.removeTrack" => library::remove(app, &request.params),
            method if method.starts_with("ui.") || matches!(method,"lyrics.openSearch"|"lyrics.setOffset") => ui::dispatch(app,principal,method,&request.params),
            "config.get" => config::get(&values, principal, &request.params),
            "config.set" => config::set(app, principal, &request.params),
            "lyrics.parse" => lyrics::parse(&request.params),
            "lyrics.get" => lyrics::get(app, &request.params),
            "sources.list" => providers::list(app, &request.params),
            "sources.search" => search::search(app, principal, &request.params),
            "sources.importTracks" => search::import(app, principal, &request.params),
            "history.recordPlayed" => history::record(app, &request.params),
            "artwork.get" | "artwork.refresh" => artwork::dispatch(app, &request.method, &request.params),
            "media.prepare" => media::prepare(app, principal, &request.params),
            method if method.starts_with("queue.") => queue::dispatch(app, &request.method, &request.params),
            "service.getConnection" => {
                if !request.params.as_object().is_some_and(|p| p.is_empty()) { return Err(Error::new("INVALID_ARGUMENT", "Unexpected parameters")); }
                crate::plugins::services::connection(app, &principal.plugin_id).map_err(|e| Error::new("INTERNAL", &e))
            }
            method if method.starts_with("files.") => files::dispatch(app, principal, method, &request.params),
            "speaker.getConnection" => {
                if !request.params.as_object().is_some_and(|p| p.is_empty()) { return Err(Error::new("INVALID_ARGUMENT", "Unexpected speaker parameters")); }
                crate::miot::connection(app).map_err(|_| Error::new("INTERNAL", "Cannot start speaker service"))
            }
            "window.startDragging" => {
                if !request.params.as_object().is_some_and(|p| p.is_empty()) { return Err(Error::new("INVALID_ARGUMENT", "Unexpected window parameters")); }
                // Current page sessions are created only by the main window (sessions.rs).
                app.get_webview_window(principal.surface.strip_prefix("desktop:").unwrap_or("main")).ok_or_else(|| Error::new("NOT_FOUND", "Host window is unavailable"))?
                    .start_dragging().map_err(|_| Error::new("INTERNAL", "Cannot drag host window"))?;
                Ok(Value::Null)
            }
            method if method.starts_with("storage.") => storage::dispatch(app, principal, method, &request.params),
            method if method.starts_with("favorites.") || method.starts_with("playlists.") => collections::dispatch(app, method, &request.params),
            method if method.starts_with("player.") => player::dispatch(app, method, &request.params),
            _ => Err(Error::new("UNSUPPORTED", "Unknown method")),
        }
    })();
    crate::models::plugin_api::response(&request.request_id, result)
}
