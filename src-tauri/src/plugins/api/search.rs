use super::{authorization::Principal, providers};
use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use std::{collections::HashMap, sync::Mutex, time::{Duration, Instant}};

#[derive(Default)]
pub(crate) struct State(Mutex<HashMap<(String, String), SearchResults>>);
struct SearchResults {
    updated: Instant,
    tracks: Vec<(String, crate::models::Track)>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Query {
    query: String,
    provider_id: String,
    limit: Option<usize>,
    cursor: Option<String>,
}

// Keep the provider page size fixed, even when a consumer changes its public page size.
const PROVIDER_PAGE_SIZE: usize = 50;

pub(super) fn search(app: &AppHandle, principal: &Principal, params: &Value) -> Result<Value> {
    let query: Query = serde_json::from_value(params.clone())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "Invalid source query"))?;
    let limit = query.limit.unwrap_or(50);
    if query.query.trim().is_empty() || query.query.len() > 4096 || !(1..=200).contains(&limit) {
        return Err(Error::new("INVALID_ARGUMENT", "Expected a query and a limit between 1 and 200"));
    }
    let manifest = providers::installed(app, "search")?.into_iter()
        .find(|p| p["id"] == query.provider_id)
        .ok_or_else(|| Error::new("NOT_FOUND", "Search provider is unavailable"))?;
    let scope = digest(&json!([principal.plugin_id, principal.package_revision,
        query.provider_id, manifest["packageRevision"], query.query]));
    let (page, offset, expected) = cursor(query.cursor.as_deref(), &scope)?;
    let response = providers::invoke(app, &manifest, json!({
        "action":"search", "keyword":query.query, "page":page, "pageSize":PROVIDER_PAGE_SIZE,
    }))?;
    if response["error"].as_str().is_some_and(|error| !error.trim().is_empty()) {
        return Err(Error::new("INTERNAL", "Provider search failed"));
    }
    let raw = response["tracks"].as_array()
        .ok_or_else(|| Error::new("INTERNAL", "Provider returned an invalid search page"))?;
    let tracks = raw.iter().map(|track| {
        let track = crate::plugins::normalize_plugin_search_track(track.clone(),
            &query.provider_id, manifest["name"].as_str().unwrap_or_default());
        serde_json::from_value::<crate::models::Track>(json!({
            "id":0, "path":format!("plugin://{}/{}", query.provider_id, track.id),
            "title":track.title, "artist":track.artist, "album":track.album,
            "duration":track.duration, "artwork":track.artwork,
            "sourceProviderId":query.provider_id, "sourceId":track.id,
            "sourceName":track.provider_name, "sourceRaw":track.source_raw,
            "year":track.year.and_then(|v| u32::try_from(v).ok()), "genre":track.genre,
            "trackNumber":track.track_number.and_then(|v| u32::try_from(v).ok()),
        })).map_err(|_| Error::new("INTERNAL", "Invalid provider track"))
    }).collect::<Result<Vec<_>>>()?;
    let items = tracks.iter().map(|track| {
        let mut value = super::library::public_track(track);
        // Search-only tracks are not yet resolvable by artwork.get.
        value["artworkRef"] = Value::Null;
        value
    }).collect::<Vec<_>>();
    let ended = response["isEnd"].as_bool().unwrap_or(items.is_empty());
    let result = page_result(items, ended, &scope, page, offset, expected.as_deref(), limit)?;
    let state = app.state::<State>();
    let mut cache = state.0.lock().map_err(|_| Error::new("INTERNAL", "Cannot cache search results"))?;
    cache.retain(|_, results| results.updated.elapsed() < Duration::from_secs(600));
    let key = (principal.plugin_id.clone(), principal.package_revision.clone());
    let results = cache.entry(key).or_insert_with(|| SearchResults { updated: Instant::now(), tracks: Vec::new() });
    results.updated = Instant::now();
    for track in tracks.into_iter().skip(offset).take(limit) {
        results.tracks.retain(|(_, saved)| saved.source_id != track.source_id || saved.source_provider_id != track.source_provider_id);
        results.tracks.push((manifest["packageRevision"].as_str().unwrap_or_default().into(), track));
    }
    let overflow = results.tracks.len().saturating_sub(2000);
    results.tracks.drain(..overflow);
    Ok(result)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ImportTrack { provider_id: String, source_id: String }

pub(super) fn import(app: &AppHandle, principal: &Principal, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Import { tracks: Vec<ImportTrack> }
    let input: Import = serde_json::from_value(params.clone())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "Expected providerId and sourceId"))?;
    if input.tracks.is_empty() || input.tracks.len() > 200 {
        return Err(Error::new("INVALID_ARGUMENT", "Import between 1 and 200 tracks"));
    }
    let _guard = crate::plugins::management::MUTATION_LOCK.lock()
        .map_err(|_| Error::new("INTERNAL", "Cannot access plugins"))?;
    let values = crate::store::read_values(app).map_err(|_| Error::new("INTERNAL", "Cannot read authorization"))?;
    if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) {
        return Err(Error::new("PLUGIN_DISABLED", "Plugins are disabled"));
    }
    let manifest = values.get("plugins.installed").and_then(Value::as_array)
        .and_then(|items| items.iter().find(|p| p["id"] == principal.plugin_id));
    super::authorization::authorize(principal, manifest,
        values.get("plugins.api.grants").and_then(|g| g.get(&principal.plugin_id)), Some("sources.import"))?;
    let providers = providers::installed(app, "search")?;
    let state = app.state::<State>();
    let cache = state.0.lock().map_err(|_| Error::new("INTERNAL", "Cannot access search results"))?;
    let results = cache.get(&(principal.plugin_id.clone(), principal.package_revision.clone()))
        .filter(|results| results.updated.elapsed() < Duration::from_secs(600))
        .ok_or_else(|| Error::new("NOT_FOUND", "Search results expired; search again"))?;
    let tracks = resolve_imports(results, &input.tracks, &providers)?;
    drop(cache);
    let state = app.state::<crate::state::AppState>();
    let mut db = state.db.lock().map_err(|_| Error::new("INTERNAL", "Cannot access library"))?;
    let saved = crate::database::imported_tracks::insert(&mut db, &tracks)
        .map_err(|_| Error::new("INTERNAL", "Cannot import tracks"))?;
    drop(db);
    let _ = tauri::Emitter::emit(app,"library-changed",());
    Ok(json!(saved.iter().map(super::library::public_track).collect::<Vec<_>>()))
}

fn resolve_imports(results: &SearchResults, input: &[ImportTrack], providers: &[Value]) -> Result<Vec<crate::models::Track>> {
    input.iter().map(|input| {
        let (revision, track) = results.tracks.iter().find(|(_, track)|
            track.source_provider_id.as_deref() == Some(&input.provider_id)
            && track.source_id.as_deref() == Some(&input.source_id))
            .ok_or_else(|| Error::new("NOT_FOUND", "Track was not returned by this plugin's search"))?;
        if !providers.iter().any(|p| p["id"] == input.provider_id && p["packageRevision"] == *revision) {
            return Err(Error::new("CONFLICT", "Provider changed; search again"));
        }
        Ok(track.clone())
    }).collect()
}

fn digest(value: &Value) -> String {
    format!("{:x}", Sha256::digest(value.to_string().as_bytes()))
}

fn cursor(value: Option<&str>, scope: &str) -> Result<(u32, usize, Option<String>)> {
    let Some(value) = value else { return Ok((1, 0, None)); };
    let invalid = || Error::new("INVALID_ARGUMENT", "Invalid search cursor");
    let parts = value.split(':').collect::<Vec<_>>();
    if parts.len() != 4 { return Err(invalid()); }
    if parts[0] != scope { return Err(Error::new("CONFLICT", "Search changed; restart pagination")); }
    let page = parts[1].parse::<u32>().map_err(|_| invalid())?;
    let offset = parts[2].parse::<usize>().map_err(|_| invalid())?;
    if page == 0 || page == u32::MAX { return Err(invalid()); }
    let expected = if parts[3] == "-" && offset == 0 { None }
        else if parts[3].len() == 64 && parts[3].bytes().all(|c| c.is_ascii_hexdigit()) { Some(parts[3].into()) }
        else { return Err(invalid()); };
    Ok((page, offset, expected))
}

fn page_result(items: Vec<Value>, ended: bool, scope: &str, page: u32,
    offset: usize, expected: Option<&str>, limit: usize) -> Result<Value> {
    let revision = digest(&json!([scope, page, items, ended]));
    if expected.is_some_and(|value| value != revision) {
        return Err(Error::new("CONFLICT", "Provider results changed; restart pagination"));
    }
    if offset > items.len() { return Err(Error::new("INVALID_ARGUMENT", "Cursor outside search page")); }
    let end = offset.saturating_add(limit).min(items.len());
    let next = if end < items.len() { Some(format!("{scope}:{page}:{end}:{revision}")) }
        else if !ended { Some(format!("{scope}:{}:0:-", page + 1)) } else { None };
    // An empty nonterminal provider page still has a cursor: do not silently lose later results.
    Ok(json!({"items":items[offset..end], "nextCursor":next, "revision":scope}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_requires_observed_ids_and_current_provider_revision() {
        let track = serde_json::from_value(json!({"id":0,"path":"plugin://p/1","title":"Song",
            "sourceProviderId":"p","sourceId":"1","sourceRaw":{"secret":"private"}})).unwrap();
        let results = SearchResults { updated: Instant::now(), tracks: vec![("v1".into(), track)] };
        let input = vec![ImportTrack { provider_id:"p".into(), source_id:"1".into() }];
        assert_eq!(resolve_imports(&results, &input, &[json!({"id":"p","packageRevision":"v2"})]).unwrap_err().code, "CONFLICT");
        let saved = resolve_imports(&results, &input, &[json!({"id":"p","packageRevision":"v1"})]).unwrap();
        let public = super::super::library::public_track(&saved[0]);
        assert!(public.get("sourceRaw").is_none());
        assert!(public.get("path").is_none());
        assert!(resolve_imports(&results, &[ImportTrack { provider_id:"p".into(), source_id:"2".into() }], &[]).is_err());
        assert!(serde_json::from_value::<ImportTrack>(json!({"providerId":"p","sourceId":"1","path":"C:/secret"})).is_err());
    }

    #[test]
    fn oversized_provider_pages_are_not_truncated() {
        let items = vec![json!(1), json!(2), json!(3)];
        let first = page_result(items.clone(), false, "scope", 1, 0, None, 2).unwrap();
        let (page, offset, revision) = cursor(first["nextCursor"].as_str(), "scope").unwrap();
        let second = page_result(items, false, "scope", page, offset, revision.as_deref(), 2).unwrap();
        assert_eq!(first["items"], json!([1, 2]));
        assert_eq!(second["items"], json!([3]));
        assert_eq!(second["nextCursor"], "scope:2:0:-");
    }

    #[test]
    fn changed_results_and_scope_reject_continuation() {
        let first = page_result(vec![json!(1), json!(2)], true, "scope", 1, 0, None, 1).unwrap();
        let token = first["nextCursor"].as_str();
        assert_eq!(cursor(token, "other").unwrap_err().code, "CONFLICT");
        let (page, offset, revision) = cursor(token, "scope").unwrap();
        assert_eq!(page_result(vec![json!(3), json!(2)], true, "scope",
            page, offset, revision.as_deref(), 1).unwrap_err().code, "CONFLICT");
    }

    #[test]
    fn empty_pages_and_invalid_cursors() {
        assert_eq!(page_result(vec![], false, "s", 1, 0, None, 1).unwrap()["nextCursor"], "s:2:0:-");
        assert!(page_result(vec![], true, "s", 2, 0, None, 1).unwrap()["nextCursor"].is_null());
        for value in ["s:0:0:-", "s:4294967295:0:-", "s:1:1:-", "s:1:0:bad", "bad"] {
            assert!(cursor(Some(value), "s").is_err());
        }
    }
}
