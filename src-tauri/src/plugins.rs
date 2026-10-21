pub(crate) mod services;
pub(crate) mod online_search;
pub(crate) mod api;
pub(crate) mod theme_links;
pub(crate) mod management;
pub(crate) mod config;
pub(crate) mod catalog;
use crate::api_response::ApiResponse;
use serde_json::json;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager};

const PLUGIN_HTTP_TIMEOUT: Duration = Duration::from_secs(8);
const OFFICIAL_PLUGIN_CATALOG_URL: &str = "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/refs/heads/master/catalog.json";
const OFFICIAL_PLUGIN_ENTRY_PREFIX: &str =
    "https://raw.githubusercontent.com/heisen16129/mono-plugin-store/";
static PLAYBACK_QUALITIES_GENERATION: AtomicU64 = AtomicU64::new(0);

fn log_plugin_playback(method: &str, args: serde_json::Value) {
    eprintln!(
        "{}",
        json!({
            "target": "plugin-playback",
            "event": method,
            "args": args,
        })
    );
}

fn json_string_field<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a str> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPlaybackPlanPlugin {
    id: String,
    name: String,
    enabled: bool,
    capabilities: Vec<String>,
    entry: Option<String>,
    permissions: Option<Vec<String>>,
    #[serde(default)]
    config: Option<Value>,
    #[serde(default)]
    config_schema: Option<Value>,
    #[serde(default)]
    package_revision: Option<String>,
}

pub(crate) fn read_playback_plugin(
    app: &AppHandle,
    provider_id: &str,
) -> Result<Vec<PluginPlaybackPlanPlugin>, String> {
    let values = crate::store::read_values(app)?;
    api::providers::playback_plan(&values, provider_id).map(|plugin| vec![plugin]).map_err(|error| error.message)
}

pub(crate) fn verify_playback_plugin(app: &AppHandle, expected: &PluginPlaybackPlanPlugin) -> Result<(), String> {
    let values = crate::store::read_values(app)?;
    let current = api::providers::playback_plan(&values, &expected.id).map_err(|error| error.message)?;
    if expected.package_revision.is_none() || current.package_revision != expected.package_revision
        || current.permissions != expected.permissions {
        return Err("Playback provider changed; retry with the current package.".into());
    }
    Ok(())
}

fn default_config_from_schema(schema: Option<&Value>) -> Value {
    let mut config = serde_json::Map::new();
    for field in schema
        .and_then(|schema| schema.get("fields"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let Some(key) = field
            .get("key")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|key| !key.is_empty())
        else {
            continue;
        };
        if let Some(value) = field
            .get("defaultValue")
            .and_then(normalize_config_default_value)
        {
            config.insert(key.to_string(), value);
        }
    }
    Value::Object(config)
}

fn merge_config_value(target: &mut Value, source: Option<&Value>) {
    let Some(source) = source.and_then(Value::as_object) else {
        return;
    };
    let Some(target) = target.as_object_mut() else {
        return;
    };
    for (key, value) in source {
        if !key.trim().is_empty() && !value.is_null() {
            target.insert(key.clone(), value.clone());
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPlaybackQualityOption {
    id: String,
    name: String,
    available: bool,
    reason: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPlaybackQualities {
    qualities: Vec<PluginPlaybackQualityOption>,
    default_quality: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSearchTrack {
    id: String,
    provider_id: String,
    provider_name: String,
    title: String,
    artist: Vec<String>,
    album: String,
    duration: Option<u64>,
    artwork: Option<String>,
    year: Option<u64>,
    genre: Option<String>,
    track_number: Option<u64>,
    #[serde(rename = "sourceRaw")]
    source_raw: serde_json::Value,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSearchPage {
    tracks: Vec<PluginSearchTrack>,
    is_end: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPlaybackSource {
    pub(crate) url: String,
    pub(crate) path: String,
    pub(crate) title: String,
    pub(crate) artist: String,
    pub(crate) album: String,
    pub(crate) duration: Option<u64>,
    pub(crate) artwork: Option<String>,
    pub(crate) lyrics: Option<PluginLyricsMetadata>,
    pub(crate) quality: String,
    pub(crate) actual_quality: Option<String>,
    pub(crate) source_id: String,
    pub(crate) source_name: String,
    pub(crate) source_provider_id: String,
    pub(crate) source_raw: serde_json::Value,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLyricsMetadata {
    pub(crate) provider_id: Option<String>,
    pub(crate) provider_name: Option<String>,
    pub(crate) track_id: Option<String>,
    pub(crate) default_format: Option<String>,
    pub(crate) lyrics: Vec<PluginLyricVariant>,
    pub(crate) track_raw: Option<serde_json::Value>,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLyricsPlaybackGuard {
    provider_id: String,
    source_id: String,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLyricVariant {
    pub(crate) format: String,
    pub(crate) content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) source_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) quality: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct PluginHttpResponse {
    pub(crate) status: u16,
    pub(crate) headers: HashMap<String, String>,
    pub(crate) body: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginCatalogItem {
    id: String,
    name: String,
    version: String,
    kind: String,
    runtime: String,
    entry: String,
    author: String,
    description: String,
    icon: Option<String>,
    updated_at: String,
    capabilities: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    highlights: Vec<String>,
    #[serde(default)]
    screenshots: Vec<String>,
    permissions: Vec<String>,
    source_url: String,
    source_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    config_schema: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    playback_bar: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sidebar: Option<Value>,
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    id: String,
    name: String,
    version: String,
    kind: String,
    runtime: String,
    entry: String,
    author: String,
    description: String,
    icon: Option<String>,
    updated_at: String,
    capabilities: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    highlights: Vec<String>,
    #[serde(default)]
    screenshots: Vec<String>,
    permissions: Vec<String>,
    source_url: Option<String>,
    source_kind: String,
    installed_at: String,
    enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    config_schema: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    playback_bar: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sidebar: Option<Value>,
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginMetadata {
    id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    kind: Option<String>,
    author: Option<String>,
    description: Option<String>,
    icon: Option<String>,
    updated_at: Option<String>,
    capabilities: Option<Vec<String>>,
    highlights: Option<Vec<String>>,
    screenshots: Option<Vec<String>>,
    permissions: Option<Vec<String>>,
    config_schema: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    playback_bar: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sidebar: Option<Value>,
}

#[tauri::command]
pub async fn plugin_invoke(
    app: AppHandle,
    entry: String,
    request: serde_json::Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
) -> ApiResponse<serde_json::Value> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _ = (entry, permissions);
        let id = plugin_id.ok_or("An installed v1 plugin ID is required")?;
        let plan = read_playback_plugin(&app,&id)?.into_iter().next().ok_or("Plugin unavailable")?;
        let action = request["action"].as_str().ok_or("Missing provider action")?;
        if !plan.capabilities.iter().any(|c|c == action) && action != "qualities" { return Err("Undeclared provider action".into()); }
        let values = crate::store::read_values(&app)?;
        let manifest = values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"] == id)).ok_or("Plugin unavailable")?;
        api::providers::invoke(&app,manifest,request).map_err(|e|e.message)
    }).await.map_err(|err| err.to_string()).and_then(|result| result);
    ApiResponse::from_result(result)
}

fn fetch_plugin_catalog_items_inner(
    _worker: &crate::workers::plugin::PluginWorkerState,
    url: String,
) -> Result<Vec<PluginCatalogItem>, String> {
    let catalog_text = fetch_plugin_catalog_backend(url)?;
    let catalog = serde_json::from_str::<Value>(&catalog_text).map_err(|err| err.to_string())?;
    Ok(normalize_catalog_values(catalog_values(catalog)))
}










#[tauri::command]
pub async fn search_plugin(
    app: AppHandle,
    provider_id: String,
    keyword: String,
    page: u64,
    page_size: u64,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<ApiResponse<PluginSearchPage>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _ = plugins;
        let plugins = read_playback_plugin(&app,&provider_id)?;
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        search_plugin_backend(&worker, provider_id, keyword, page, page_size, plugins)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

fn search_plugin_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    keyword: String,
    page: u64,
    page_size: u64,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginSearchPage, String> {
    let plugin = find_search_plugin(provider_id, plugins)?;
    let entry = plugin
        .entry
        .clone()
        .ok_or_else(|| "Plugin for selected search is missing an entry.".to_string())?;
    let query = keyword.trim();
    if query.is_empty() {
        return Ok(PluginSearchPage {
            tracks: Vec::new(),
            is_end: true,
        });
    }

    let response = worker.invoke_plugin(
        entry,
        plugin_request(
            &plugin,
            json!({
                "action": "search",
                "keyword": query,
                "page": page.max(1),
                "pageSize": page_size.clamp(1, 100),
            }),
        ),
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;

    normalize_plugin_search_page(unwrap_plugin_response_envelope(response)?, &plugin)
}

#[tauri::command]
pub async fn resolve_plugin_playback_qualities(
    app: AppHandle,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<ApiResponse<PluginPlaybackQualities>, String> {
    let generation = PLAYBACK_QUALITIES_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _ = plugins;
        let plugins = read_playback_plugin(&app,&provider_id)?;
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_playback_qualities_backend_when_ready(
            &worker,
            provider_id,
            track,
            plugins,
            || {
                if PLAYBACK_QUALITIES_GENERATION.load(Ordering::SeqCst) == generation {
                    Ok(())
                } else {
                    Err("Playback qualities request was replaced.".to_string())
                }
            },
        )
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

fn resolve_plugin_playback_qualities_backend_when_ready<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
    should_continue: F,
) -> Result<PluginPlaybackQualities, String>
where
    F: FnMut() -> Result<(), String>,
{
    resolve_plugin_playback_qualities_backend_checked(
        worker,
        provider_id,
        track,
        plugins,
        true,
        should_continue,
    )
}

fn resolve_plugin_playback_qualities_backend_checked<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
    wait_for_ready: bool,
    mut should_continue: F,
) -> Result<PluginPlaybackQualities, String>
where
    F: FnMut() -> Result<(), String>,
{
    let plugin = find_playback_plugin(provider_id, plugins)?;
    let entry = plugin
        .entry
        .clone()
        .ok_or_else(|| "Plugin for selected track is missing an entry.".to_string())?;
    let plugin_track = track;
    let request = plugin_request(
        &plugin,
        json!({
            "action": "qualities",
            "track": plugin_track,
        }),
    );

    let response = invoke_playback_plugin(
        worker,
        entry,
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        wait_for_ready,
        false,
        &mut should_continue,
    )?;

    normalize_plugin_playback_qualities(unwrap_plugin_response_envelope(response)?)
}

pub(crate) fn resolve_plugin_download_source_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    preferred_quality: Option<String>,
    quality_fallback: String,
    include_metadata: bool,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackSource, String> {
    resolve_plugin_playback_source_backend_checked(
        worker,
        provider_id,
        track,
        preferred_quality,
        quality_fallback,
        include_metadata,
        plugins,
        false,
        true,
        || Ok(()),
    )
}

pub(crate) fn resolve_plugin_download_lyrics_metadata_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginLyricsMetadata, String> {
    resolve_plugin_lyrics_metadata_backend_checked(
        worker,
        provider_id,
        track,
        plugins,
        true,
        || Ok(()),
    )
}

pub(crate) fn resolve_plugin_playback_source_backend_when_ready<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    preferred_quality: Option<String>,
    _quality_fallback: String,
    include_metadata: bool,
    plugins: Vec<PluginPlaybackPlanPlugin>,
    should_continue: F,
) -> Result<PluginPlaybackSource, String>
where
    F: FnMut() -> Result<(), String>,
{
    resolve_plugin_playback_source_backend_checked(
        worker,
        provider_id,
        track,
        preferred_quality,
        _quality_fallback,
        include_metadata,
        plugins,
        true,
        false,
        should_continue,
    )
}

fn resolve_plugin_playback_source_backend_checked<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    preferred_quality: Option<String>,
    _quality_fallback: String,
    include_metadata: bool,
    plugins: Vec<PluginPlaybackPlanPlugin>,
    wait_for_ready: bool,
    use_download_worker: bool,
    mut should_continue: F,
) -> Result<PluginPlaybackSource, String>
where
    F: FnMut() -> Result<(), String>,
{
    log_plugin_playback(
        "resolve_plugin_playback_source input",
        json!({
            "providerId": provider_id,
            "preferredQuality": preferred_quality,
            "qualityFallback": _quality_fallback,
            "includeMetadata": include_metadata,
            "track": track.clone(),
        }),
    );

    let plugin = find_playback_plugin(provider_id, plugins)?;

    let entry = plugin
        .entry
        .clone()
        .ok_or_else(|| "Plugin for selected track is missing an entry.".to_string())?;
    let plugin_track = track;
    let mut last_error = None;
    let qualities = resolve_playback_quality_attempts(
        &worker,
        &entry,
        &plugin,
        &plugin_track,
        preferred_quality.as_deref(),
        wait_for_ready,
        use_download_worker,
        &mut should_continue,
    )?;

    for quality in qualities {
        let request = plugin_request(
            &plugin,
            json!({
                "action": "play",
                "track": plugin_track.clone(),
                "quality": quality,
                "includeMetadata": include_metadata,
            }),
        );
        log_plugin_playback(
            "resolve_plugin_playback_source request",
            json!({
                "providerId": plugin.id,
                "entry": entry,
                "request": redact_plugin_request(&request),
            }),
        );

        let response = invoke_playback_plugin(
            worker,
            entry.clone(),
            request,
            Some(plugin.id.clone()),
            plugin.permissions.clone(),
            wait_for_ready,
            use_download_worker,
            &mut should_continue,
        );

        match response {
            Ok(response) => {
                log_plugin_playback(
                    "resolve_plugin_playback_source raw response",
                    json!({
                        "providerId": plugin.id,
                        "quality": quality,
                        "response": response.clone(),
                    }),
                );
                match unwrap_plugin_response_envelope(response).and_then(|data| {
                    normalize_plugin_playback_source(data, &quality, &plugin_track, &plugin)
                }) {
                    Ok(mut source) => {
                        if let Ok(artwork) = resolve_playback_cover_metadata(
                            &worker,
                            &entry,
                            &plugin,
                            &plugin_track,
                            use_download_worker,
                        ) {
                            source.artwork = Some(artwork);
                        }
                        if include_metadata && playback_source_needs_lyrics(&source) {
                            source.lyrics = resolve_playback_lyrics_metadata(
                                &worker,
                                &entry,
                                &plugin,
                                &plugin_track,
                                use_download_worker,
                            )
                            .ok();
                        }
                        log_plugin_playback(
                            "resolve_plugin_playback_source normalized response",
                            json!({
                                "providerId": plugin.id,
                                "quality": quality,
                                "source": serde_json::to_value(&source).unwrap_or(serde_json::Value::Null),
                            }),
                        );
                        return Ok(source);
                    }
                    Err(error) => {
                        log_plugin_playback(
                            "resolve_plugin_playback_source normalize error",
                            json!({
                                "providerId": plugin.id,
                                "quality": quality,
                                "error": error,
                            }),
                        );
                        last_error = Some(error);
                    }
                }
            }
            Err(error) => {
                log_plugin_playback(
                    "resolve_plugin_playback_source invoke error",
                    json!({
                        "providerId": plugin.id,
                        "quality": quality,
                        "error": error,
                    }),
                );
                last_error = Some(error);
            }
        }
    }

    let error =
        last_error.unwrap_or_else(|| "Unable to resolve plugin playback source.".to_string());
    log_plugin_playback(
        "resolve_plugin_playback_source error",
        json!({
            "providerId": plugin.id,
            "error": error,
        }),
    );
    Err(error)
}

#[tauri::command]
pub async fn resolve_plugin_lyrics_metadata(
    app: AppHandle,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
    playback_guard: Option<PluginLyricsPlaybackGuard>,
) -> Result<ApiResponse<PluginLyricsMetadata>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _ = plugins;
        let plugins = read_playback_plugin(&app,&provider_id)?;
        let track_id = json_string_field(&track, &["sourceId", "id"])
            .unwrap_or("")
            .trim()
            .to_string();
        if let Some(cached) =
            crate::player::read_cached_plugin_lyrics_metadata(&app, &provider_id, &track_id)
        {
            return Ok(cached);
        }
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        let lyrics = resolve_plugin_lyrics_metadata_backend_checked(
            &worker,
            provider_id.clone(),
            track,
            plugins,
            false,
            || {
                let Some(guard) = playback_guard.as_ref() else {
                    return Ok(());
                };
                if crate::player::is_current_plugin_queue_track(
                    &app,
                    &guard.provider_id,
                    &guard.source_id,
                )? {
                    Ok(())
                } else {
                    Err("Playback request was replaced.".to_string())
                }
            },
        )?;
        crate::player::write_cached_plugin_lyrics_metadata(&app, &provider_id, &track_id, &lyrics);
        Ok(lyrics)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

pub(crate) fn resolve_plugin_cover_metadata_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<String, String> {
    let plugin = plugins
        .into_iter()
        .find(|plugin| plugin.id == provider_id)
        .ok_or_else(|| "Plugin for selected track is not installed.".to_string())?;

    if !plugin.enabled {
        return Err("Plugin for selected track is not enabled.".to_string());
    }

    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "cover")
    {
        return Err("Plugin for selected track does not support cover.".to_string());
    }

    let entry = plugin
        .entry
        .clone()
        .ok_or_else(|| "Plugin for selected track is missing an entry.".to_string())?;
    let plugin_track = track;
    let request = plugin_request(
        &plugin,
        json!({
            "action": "cover",
            "track": plugin_track,
        }),
    );
    let response = worker.invoke_plugin(
        entry,
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;

    normalize_plugin_cover_metadata(unwrap_plugin_response_envelope(response)?)
}

fn resolve_plugin_lyrics_metadata_backend_checked<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
    use_download_worker: bool,
    mut should_continue: F,
) -> Result<PluginLyricsMetadata, String>
where
    F: FnMut() -> Result<(), String>,
{
    let plugin = plugins
        .into_iter()
        .find(|plugin| plugin.id == provider_id)
        .ok_or_else(|| "Plugin for selected track is not installed.".to_string())?;

    if !plugin.enabled {
        return Err("Plugin for selected track is not enabled.".to_string());
    }

    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "lyrics")
    {
        return Err("Plugin for selected track does not support lyrics.".to_string());
    }

    let entry = plugin
        .entry
        .clone()
        .ok_or_else(|| "Plugin for selected track is missing an entry.".to_string())?;
    let plugin_track = track;
    let request = plugin_request(
        &plugin,
        json!({
            "action": "lyrics",
            "track": plugin_track,
        }),
    );

    should_continue()?;
    let response = invoke_plugin_on_worker(
        worker,
        entry,
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        use_download_worker,
    )?;
    should_continue()?;

    normalize_plugin_lyrics_metadata(unwrap_plugin_response_envelope(response)?)
}

fn normalize_plugin_playback_source(
    response: serde_json::Value,
    fallback_quality: &str,
    track: &serde_json::Value,
    plugin: &PluginPlaybackPlanPlugin,
) -> Result<PluginPlaybackSource, String> {
    if let Some(error) = response.get("error").and_then(|value| value.as_str()) {
        if !error.trim().is_empty() {
            return Err(error.to_string());
        }
    }

    let url = response
        .get("url")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Plugin did not return a playback url.".to_string())?
        .to_string();
    let artwork = response
        .get("artwork")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());
    let lyrics = response
        .get("lyrics")
        .filter(|value| value.is_object())
        .cloned()
        .map(normalize_plugin_lyrics_metadata)
        .transpose()?
        .filter(lyrics_metadata_has_content);
    let quality = response
        .get("quality")
        .and_then(|value| value.as_str())
        .unwrap_or(fallback_quality)
        .to_string();
    let title = json_string_field(track, &["title", "name"])
        .unwrap_or("")
        .to_string();
    let artist = json_artist_names(track).join(" / ");
    let album = json_string_field(track, &["album", "albumName"])
        .unwrap_or("")
        .to_string();
    let duration = json_duration_seconds(track);
    let source_id = json_string_field(&response, &["sourceId"])
        .or_else(|| json_string_field(track, &["sourceId"]))
        .unwrap_or("")
        .to_string();
    let source_raw = response
        .get("sourceRaw")
        .cloned()
        .or_else(|| track.get("sourceRaw").cloned())
        .unwrap_or(Value::Null);

    Ok(PluginPlaybackSource {
        path: url.clone(),
        url,
        title,
        artist,
        album,
        duration,
        artwork,
        lyrics,
        quality: quality.clone(),
        actual_quality: response.get("actualQuality").and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).map(str::to_string).or_else(|| Some(quality)),
        source_id,
        source_name: plugin.name.clone(),
        source_provider_id: plugin.id.clone(),
        source_raw,
    })
}

fn playback_source_needs_lyrics(source: &PluginPlaybackSource) -> bool {
    source
        .lyrics
        .as_ref()
        .map(|lyrics| lyrics.lyrics.is_empty())
        .unwrap_or(true)
}

fn lyrics_metadata_has_content(lyrics: &PluginLyricsMetadata) -> bool {
    !lyrics.lyrics.is_empty()
}

fn resolve_playback_lyrics_metadata(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: &str,
    plugin: &PluginPlaybackPlanPlugin,
    track: &serde_json::Value,
    use_download_worker: bool,
) -> Result<PluginLyricsMetadata, String> {
    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "lyrics")
    {
        return Err("Plugin does not support lyrics.".to_string());
    }

    let request = plugin_request(
        plugin,
        json!({
            "action": "lyrics",
            "track": track,
        }),
    );
    let response = invoke_plugin_on_worker(
        worker,
        entry.to_string(),
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        use_download_worker,
    )?;
    normalize_plugin_lyrics_metadata(unwrap_plugin_response_envelope(response)?)
}

fn resolve_playback_cover_metadata(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: &str,
    plugin: &PluginPlaybackPlanPlugin,
    track: &serde_json::Value,
    use_download_worker: bool,
) -> Result<String, String> {
    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "cover")
    {
        return Err("Plugin does not support cover.".to_string());
    }

    let request = plugin_request(
        plugin,
        json!({
            "action": "cover",
            "track": track,
        }),
    );
    let response = invoke_plugin_on_worker(
        worker,
        entry.to_string(),
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        use_download_worker,
    )?;
    normalize_plugin_cover_metadata(unwrap_plugin_response_envelope(response)?)
}

fn json_duration_seconds(value: &serde_json::Value) -> Option<u64> {
    let duration = value
        .get("duration")
        .or_else(|| value.get("interval"))
        .or_else(|| value.get("time"))?;
    if let Some(number) = duration.as_u64() {
        return Some(number);
    }
    if let Some(text) = duration.as_str() {
        return text.trim().parse::<u64>().ok();
    }
    None
}

fn normalize_plugin_search_page(
    response: serde_json::Value,
    plugin: &PluginPlaybackPlanPlugin,
) -> Result<PluginSearchPage, String> {
    if let Some(error) = response.get("error").and_then(|value| value.as_str()) {
        if !error.trim().is_empty() {
            return Err(error.to_string());
        }
    }

    let raw_tracks = response
        .get("tracks")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    let tracks = raw_tracks
        .into_iter()
        .map(|track| normalize_plugin_search_track(track, &plugin.id, &plugin.name))
        .collect::<Vec<_>>();
    let is_end = response
        .get("isEnd")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(tracks.is_empty());

    Ok(PluginSearchPage { tracks, is_end })
}

fn normalize_plugin_search_track(
    track: serde_json::Value,
    provider_id: &str,
    provider_name: &str,
) -> PluginSearchTrack {
    let source_raw = track
        .get("sourceRaw")
        .cloned()
        .unwrap_or_else(|| track.clone());
    let title = json_string_field(&track, &["title", "name"])
        .unwrap_or("Unknown Track")
        .to_string();
    let id = json_search_id(&track).unwrap_or_else(|| format!("{}:{}", provider_id, title));

    PluginSearchTrack {
        id,
        provider_id: provider_id.to_string(),
        provider_name: provider_name.to_string(),
        title,
        artist: json_search_artist_names(&track)
            .filter(|artists| !artists.is_empty())
            .unwrap_or_else(|| vec!["Unknown Artist".to_string()]),
        album: json_string_field(&track, &["album", "albumName"])
            .unwrap_or("")
            .to_string(),
        duration: json_search_duration_seconds(&track),
        artwork: json_string_field(&track, &["artwork", "cover", "picUrl"]).map(str::to_string),
        year: json_search_year(&track),
        genre: json_string_field(&track, &["genre", "style"]).map(str::to_string),
        track_number: json_search_positive_integer(
            &track,
            &["trackNumber", "trackNo", "track_no", "index"],
        ),
        source_raw,
    }
}

fn json_search_id(value: &serde_json::Value) -> Option<String> {
    ["id", "songmid", "mid", "hash"]
        .iter()
        .find_map(|key| value.get(*key))
        .and_then(json_value_to_string)
        .filter(|value| !value.trim().is_empty())
}

fn json_search_artist_names(value: &serde_json::Value) -> Option<Vec<String>> {
    let names = json_artist_names(value);
    if !names.is_empty() {
        return Some(names);
    }

    let artists = value.get("artists")?.as_array()?;
    let names = artists
        .iter()
        .filter_map(|artist| {
            artist
                .as_str()
                .or_else(|| artist.get("name").and_then(serde_json::Value::as_str))
        })
        .flat_map(split_artist_name)
        .collect::<Vec<_>>();
    if names.is_empty() {
        None
    } else {
        Some(names)
    }
}

fn json_artist_names(value: &serde_json::Value) -> Vec<String> {
    ["artist", "singer", "author"]
        .iter()
        .find_map(|key| value.get(*key))
        .map(json_artist_value_names)
        .unwrap_or_default()
}

fn json_artist_value_names(value: &serde_json::Value) -> Vec<String> {
    if let Some(artist) = value.as_str() {
        return split_artist_name(artist).collect();
    }

    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|artist| {
            artist
                .as_str()
                .or_else(|| artist.get("name").and_then(serde_json::Value::as_str))
        })
        .flat_map(split_artist_name)
        .collect()
}

fn split_artist_name(value: &str) -> impl Iterator<Item = String> + '_ {
    crate::models::artist_names(value).into_iter()
}

fn json_search_duration_seconds(value: &serde_json::Value) -> Option<u64> {
    [
        "duration",
        "interval",
        "time",
        "songTime",
        "song_time",
        "play_time",
        "durationText",
        "duration_text",
    ]
    .iter()
    .find_map(|key| value.get(*key).and_then(json_duration_value_seconds))
    .or_else(|| {
        ["duration_ms", "interval_ms"].iter().find_map(|key| {
            value
                .get(*key)
                .and_then(json_numeric_value)
                .map(|ms| (ms / 1000.0).round() as u64)
        })
    })
}

fn json_duration_value_seconds(value: &serde_json::Value) -> Option<u64> {
    if let Some(number) = json_numeric_value(value) {
        return Some(if number > 1000.0 {
            (number / 1000.0).round() as u64
        } else {
            number.round() as u64
        });
    }

    let text = value.as_str()?.trim();
    if !text.contains(':') {
        return None;
    }
    let mut total = 0_u64;
    for part in text.split(':') {
        total = total.checked_mul(60)? + part.parse::<u64>().ok()?;
    }
    Some(total)
}

fn json_search_year(value: &serde_json::Value) -> Option<u64> {
    [
        "year",
        "releaseYear",
        "publishYear",
        "publish_time",
        "releaseDate",
        "release_date",
        "date",
    ]
    .iter()
    .find_map(|key| value.get(*key).and_then(json_year_value))
}

fn json_year_value(value: &serde_json::Value) -> Option<u64> {
    if let Some(number) = value.as_u64() {
        return (1000..=9999).contains(&number).then_some(number);
    }

    let text = value.as_str()?;
    let mut digit_count = 0;
    let mut rolling_year = 0_u64;
    for character in text.chars() {
        if let Some(digit) = character.to_digit(10) {
            digit_count += 1;
            rolling_year = ((rolling_year % 1000) * 10) + u64::from(digit);
            if digit_count >= 4 && (1900..=2099).contains(&rolling_year) {
                return Some(rolling_year);
            }
        } else {
            digit_count = 0;
            rolling_year = 0;
        }
    }
    None
}

fn json_search_positive_integer(value: &serde_json::Value, keys: &[&str]) -> Option<u64> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_str()?.trim().parse::<u64>().ok())
        })
        .filter(|number| *number > 0)
}

fn json_numeric_value(value: &serde_json::Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str()?.trim().parse::<f64>().ok())
        .filter(|number| number.is_finite())
}

fn json_value_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) if !text.trim().is_empty() => Some(text.clone()),
        serde_json::Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn normalize_catalog_values(values: Vec<Value>) -> Vec<PluginCatalogItem> {
    values
        .into_iter()
        .filter_map(normalize_catalog_item_value)
        .collect()
}

fn catalog_values(catalog: Value) -> Vec<Value> {
    if let Some(items) = catalog.as_array() {
        return items.clone();
    }

    catalog
        .get("plugins")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}


fn is_official_plugin_source(source: &str) -> bool {
    source == OFFICIAL_PLUGIN_CATALOG_URL || source.starts_with(OFFICIAL_PLUGIN_ENTRY_PREFIX)
}

fn infer_plugin_source_kind(entry: &str, source_url: Option<&str>) -> String {
    if is_official_plugin_source(entry)
        || source_url.map(is_official_plugin_source).unwrap_or(false)
    {
        return "official".to_string();
    }
    if entry.starts_with("http://")
        || entry.starts_with("https://")
        || source_url
            .map(|url| url.starts_with("http://") || url.starts_with("https://"))
            .unwrap_or(false)
    {
        return "subscription".to_string();
    }
    "local".to_string()
}


fn normalize_catalog_item_value(value: Value) -> Option<PluginCatalogItem> {
    let mut manifest_value = value.clone();
    let object = manifest_value.as_object_mut()?;
    for key in ["packageUrl", "updatedAt", "icon", "screenshots", "highlights"] { object.remove(key); }
    let manifest: api::manifest::Manifest = serde_json::from_value(manifest_value).ok()?;
    api::manifest::validate(&manifest, env!("CARGO_PKG_VERSION")).ok()?;
    let entry = value["packageUrl"].as_str()?.to_string();
    let url = tauri::Url::parse(&entry).ok()?;
    if !matches!(url.scheme(), "http" | "https") || !url.path().ends_with(".monoplugin.zip") { return None; }
    let capabilities = manifest.capabilities;
    Some(PluginCatalogItem {
        id:manifest.id, name:manifest.name, version:manifest.version, kind:manifest.kind,
        runtime:if manifest.entry.renderer.is_some() { "module" } else if manifest.entry.service.is_some() { "node" } else { "wasm" }.into(),
        source_kind:infer_plugin_source_kind(&entry,Some(&entry)), source_url:entry.clone(), entry,
        author:manifest.author, description:manifest.description,
        icon:string_field(&value,&["icon"]), updated_at:string_field(&value,&["updatedAt"]).unwrap_or_default(),
        tags:plugin_capability_tags(&capabilities), capabilities, permissions:manifest.permissions,
        highlights:array_string_field(&value,"highlights").unwrap_or_default(),
        screenshots:array_string_field(&value,"screenshots").unwrap_or_default(),
        playback_bar:None, sidebar:None, config_schema:manifest.config_schema,
    })
}




fn unwrap_plugin_response_envelope(response: Value) -> Result<Value, String> {
    let code = response
        .get("code")
        .and_then(Value::as_u64)
        .ok_or_else(|| "plugin response missing ApiResponse code".to_string())?;
    let message = response
        .get("message")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(if code == 1 {
            "plugin call succeeded"
        } else {
            "plugin call failed"
        });

    if code != 1 {
        return Err(message.to_string());
    }

    response
        .get("data")
        .cloned()
        .filter(|value| !value.is_null())
        .ok_or_else(|| "plugin ApiResponse success missing data".to_string())
}










fn normalize_config_default_value(value: &Value) -> Option<Value> {
    match value {
        Value::String(text) if !text.trim().is_empty() => {
            Some(Value::String(text.trim().to_string()))
        }
        Value::Number(number) => Some(Value::Number(number.clone())),
        Value::Bool(value) => Some(Value::Bool(*value)),
        Value::Array(values) => {
            let values = values
                .iter()
                .filter_map(json_value_to_string)
                .map(Value::String)
                .collect::<Vec<_>>();
            (!values.is_empty()).then_some(Value::Array(values))
        }
        _ => None,
    }
}





fn plugin_capability_tags(capabilities: &[String]) -> Vec<String> {
    capabilities
        .iter()
        .map(|capability| match capability.as_str() {
            "search" => "搜索歌曲",
            "play" => "在线播放",
            "lyrics" => "歌词获取",
            "stem-separation" => "人声 / 伴奏分离",
            "speaker-control" => "智能音箱",
            _ => capability.as_str(),
        })
        .map(str::to_string)
        .fold(Vec::<String>::new(), |mut items, tag| {
            if !items.contains(&tag) {
                items.push(tag);
            }
            items
        })
}





fn string_field(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn array_string_field(value: &Value, key: &str) -> Option<Vec<String>> {
    Some(
        value
            .get(key)?
            .as_array()?
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
    )
}


fn find_search_plugin(
    provider_id: String,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackPlanPlugin, String> {
    let plugin = plugins
        .into_iter()
        .find(|plugin| plugin.id == provider_id)
        .ok_or_else(|| "Plugin for selected search is not installed.".to_string())?;

    if !plugin.enabled {
        return Err("Plugin for selected search is not enabled.".to_string());
    }

    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "search")
    {
        return Err("Plugin for selected search does not support search.".to_string());
    }

    Ok(plugin)
}

fn find_playback_plugin(
    provider_id: String,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackPlanPlugin, String> {
    let plugin = plugins
        .into_iter()
        .find(|plugin| plugin.id == provider_id)
        .ok_or_else(|| "Plugin for selected track is not installed.".to_string())?;

    if !plugin.enabled {
        return Err("Plugin for selected track is not enabled.".to_string());
    }

    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "play")
    {
        return Err("Plugin for selected track does not support playback.".to_string());
    }

    Ok(plugin)
}

fn normalize_plugin_playback_qualities(
    response: serde_json::Value,
) -> Result<PluginPlaybackQualities, String> {
    if let Some(error) = response.get("error").and_then(|value| value.as_str()) {
        if !error.trim().is_empty() {
            return Err(error.to_string());
        }
    }

    let qualities = response
        .get("qualities")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(normalize_plugin_playback_quality_option)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if qualities.is_empty() {
        return Err("Plugin did not return playback qualities.".to_string());
    }

    let default_quality = response
        .get("defaultQuality")
        .and_then(serde_json::Value::as_str)
        .filter(|quality| {
            qualities
                .iter()
                .any(|item| item.id == *quality && item.available)
        })
        .map(str::to_string)
        .or_else(|| {
            qualities
                .iter()
                .find(|quality| quality.available)
                .map(|quality| quality.id.clone())
        });

    Ok(PluginPlaybackQualities {
        qualities,
        default_quality,
    })
}

fn normalize_plugin_playback_quality_option(
    value: &serde_json::Value,
) -> Option<PluginPlaybackQualityOption> {
    let id = value.get("id")?.as_str()?.trim();
    if id.is_empty() {
        return None;
    }

    Some(PluginPlaybackQualityOption {
        id: id.to_string(),
        name: value
            .get("name")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or(id)
            .to_string(),
        available: value
            .get("available")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true),
        reason: value
            .get("reason")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|reason| !reason.is_empty())
            .map(str::to_string),
    })
}

fn normalize_plugin_lyrics_metadata(
    response: serde_json::Value,
) -> Result<PluginLyricsMetadata, String> {
    if let Some(error) = response.get("error").and_then(|value| value.as_str()) {
        if !error.trim().is_empty() {
            return Err(error.to_string());
        }
    }

    let lyrics = normalize_plugin_lyric_variants(response.get("lyrics"))?;
    let default_format = json_string_field(&response, &["defaultFormat"])
        .and_then(|value| normalize_lyrics_format(Some(value)));
    let default_format = default_format.or_else(|| lyrics.first().map(|item| item.format.clone()));

    Ok(PluginLyricsMetadata {
        provider_id: json_string_field(&response, &["providerId"]).map(str::to_string),
        provider_name: json_string_field(&response, &["providerName"]).map(str::to_string),
        track_id: json_string_field(&response, &["trackId"]).map(str::to_string),
        default_format,
        lyrics,
        track_raw: response.get("sourceRaw").cloned(),
    })
}

fn normalize_plugin_cover_metadata(response: serde_json::Value) -> Result<String, String> {
    let artwork_url = response
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "Plugin cover response must be a URL string.".to_string())?;
    log_plugin_playback(
        "normalize_plugin_cover_metadata response",
        json!({ "artworkUrl": artwork_url }),
    );
    Ok(artwork_url)
}

fn normalize_lyrics_format(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    match value {
        "lrc" | "trans" | "yrc" | "qrc" | "krc" | "a2" => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_plugin_lyric_variants(
    value: Option<&Value>,
) -> Result<Vec<PluginLyricVariant>, String> {
    let Some(items) = value.and_then(Value::as_array) else {
        return Err("Plugin lyrics response must include lyrics[].".to_string());
    };
    let mut lyrics = Vec::new();
    for item in items {
        let Some(format) = item
            .get("format")
            .and_then(Value::as_str)
            .and_then(|value| normalize_lyrics_format(Some(value)))
        else {
            continue;
        };
        if lyrics
            .iter()
            .any(|variant: &PluginLyricVariant| variant.format == format)
        {
            continue;
        }
        let Some(content) = item
            .get("content")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|content| !content.is_empty())
        else {
            continue;
        };
        lyrics.push(PluginLyricVariant {
            format,
            content: content.to_string(),
            source_url: item
                .get("sourceUrl")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            quality: item
                .get("quality")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
        });
    }
    if lyrics.is_empty() {
        return Err("Plugin lyrics response did not include usable lyrics[].".to_string());
    }
    Ok(lyrics)
}

fn invoke_playback_plugin<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: String,
    request: serde_json::Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
    wait_for_ready: bool,
    use_download_worker: bool,
    should_continue: &mut F,
) -> Result<serde_json::Value, String>
where
    F: FnMut() -> Result<(), String>,
{
    if use_download_worker {
        should_continue()?;
        return worker.invoke_download_plugin(entry, request, plugin_id, permissions);
    }

    if wait_for_ready {
        worker.invoke_plugin_when_ready(entry, request, plugin_id, permissions, should_continue)
    } else {
        worker.invoke_plugin(entry, request, plugin_id, permissions)
    }
}

fn invoke_plugin_on_worker(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: String,
    request: serde_json::Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
    use_download_worker: bool,
) -> Result<serde_json::Value, String> {
    if use_download_worker {
        worker.invoke_download_plugin(entry, request, plugin_id, permissions)
    } else {
        worker.invoke_plugin(entry, request, plugin_id, permissions)
    }
}

fn plugin_request(plugin: &PluginPlaybackPlanPlugin, mut request: Value) -> Value {
    if let Some(config) = plugin.config.as_ref().filter(|config| !config.is_null()) {
        if let Some(object) = request.as_object_mut() {
            object.insert("config".to_string(), config.clone());
        }
    }
    request
}

fn redact_plugin_request(request: &Value) -> Value {
    let mut redacted = request.clone();
    if let Some(object) = redacted.as_object_mut() {
        if let Some(config) = object.get("config").cloned() {
            object.insert("config".to_string(), redact_secret_value(&config));
        }
        for key in ["key", "apiKey", "api_key", "token", "secret"] {
            if object.contains_key(key) {
                object.insert(key.to_string(), Value::String("***".to_string()));
            }
        }
    }
    redacted
}

fn redact_secret_value(value: &Value) -> Value {
    let Some(object) = value.as_object() else {
        return Value::String("***".to_string());
    };
    Value::Object(
        object
            .iter()
            .map(|(key, value)| {
                let key_lower = key.to_ascii_lowercase();
                let next_value = if key_lower.contains("key")
                    || key_lower.contains("token")
                    || key_lower.contains("secret")
                {
                    Value::String("***".to_string())
                } else {
                    value.clone()
                };
                (key.clone(), next_value)
            })
            .collect(),
    )
}

fn resolve_playback_quality_attempts<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: &str,
    plugin: &PluginPlaybackPlanPlugin,
    track: &serde_json::Value,
    preferred_quality: Option<&str>,
    wait_for_ready: bool,
    use_download_worker: bool,
    should_continue: &mut F,
) -> Result<Vec<String>, String>
where
    F: FnMut() -> Result<(), String>,
{
    let request = plugin_request(
        plugin,
        json!({
            "action": "qualities",
            "track": track,
        }),
    );
    let response = invoke_playback_plugin(
        worker,
        entry.to_string(),
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        wait_for_ready,
        use_download_worker,
        should_continue,
    )?;
    let qualities =
        normalize_plugin_playback_qualities(unwrap_plugin_response_envelope(response)?)?;

    let default_quality = qualities.default_quality;
    let available = qualities
        .qualities
        .into_iter()
        .filter(|quality| quality.available)
        .map(|quality| quality.id)
        .collect::<Vec<_>>();
    if available.is_empty() {
        return Err("Plugin did not return any available playback qualities.".to_string());
    }

    let mut attempts = Vec::new();
    if let Some(preferred_quality) = preferred_quality
        .filter(|preferred_quality| available.iter().any(|quality| quality == preferred_quality))
    {
        attempts.push(preferred_quality.to_string());
    } else if let Some(default_quality) = default_quality.filter(|quality| {
        available
            .iter()
            .any(|available_quality| available_quality == quality)
    }) {
        attempts.push(default_quality);
    }
    for quality in available {
        if !attempts.iter().any(|item| item == &quality) {
            attempts.push(quality);
        }
    }
    Ok(attempts)
}

pub(crate) fn fetch_plugin_catalog_backend(url: String) -> Result<String, String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("plugin catalog url must start with http:// or https://".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(PLUGIN_HTTP_TIMEOUT)
        .user_agent("Mono Player/0.1.0")
        .build()
        .map_err(|err| err.to_string())?;

    let response = client.get(url).send().map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {}", status.as_u16()));
    }

    response.text().map_err(|err| err.to_string())
}

pub(crate) fn read_plugin_wasm_bytes_backend(
    entry: String,
    cache_root: Option<&Path>,
    refresh_cache: bool,
) -> Result<Vec<u8>, String> {
    if entry.starts_with("https://") || entry.starts_with("http://") {
        if !refresh_cache {
            if let Some(cache_path) = remote_plugin_wasm_cache_path(cache_root, &entry) {
                if cache_path.is_file() {
                    return fs::read(&cache_path)
                        .map_err(|err| format!("{}: {}", cache_path.display(), err));
                }
            }
        }

        let client = reqwest::blocking::Client::builder()
            .timeout(PLUGIN_HTTP_TIMEOUT)
            .user_agent("Mono Player/0.1.0")
            .build()
            .map_err(|err| err.to_string())?;

        let response = client.get(&entry).send().map_err(|err| err.to_string())?;
        let status = response.status();
        if !status.is_success() {
            return Err(format!("HTTP {}", status.as_u16()));
        }

        let bytes = response
            .bytes()
            .map(|bytes| bytes.to_vec())
            .map_err(|err| err.to_string())?;

        if let Some(cache_path) = remote_plugin_wasm_cache_path(cache_root, &entry) {
            if let Some(parent) = cache_path.parent() {
                if let Err(error) = fs::create_dir_all(parent) {
                    eprintln!("[plugin-cache] create cache dir failed: {error}");
                    return Ok(bytes);
                }
            }
            if let Err(error) = fs::write(&cache_path, &bytes) {
                eprintln!("[plugin-cache] write wasm cache failed: {error}");
            }
        }

        return Ok(bytes);
    }

    let path = resolve_local_plugin_wasm_path(&entry);
    fs::read(&path).map_err(|err| format!("{}: {}", path.display(), err))
}

fn remote_plugin_wasm_cache_path(cache_root: Option<&Path>, entry: &str) -> Option<PathBuf> {
    let cache_root = cache_root?;
    Some(
        crate::player::mono_cache_dir(cache_root)
            .join("plugin-wasm")
            .join(format!("{}.wasm", remote_plugin_wasm_cache_key(entry))),
    )
}

fn remote_plugin_wasm_cache_key(entry: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in entry.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn resolve_local_plugin_wasm_path(entry: &str) -> PathBuf {
    let path = Path::new(entry);
    if path.is_absolute() || path.exists() {
        return path.to_path_buf();
    }

    let manifest_root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest_root.join(entry),
        manifest_root.join("..").join(entry),
    ];

    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .unwrap_or_else(|| path.to_path_buf())
}

pub(crate) fn plugin_http_request_backend(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    data: Option<String>,
) -> Result<PluginHttpResponse, String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("plugin request url must start with http:// or https://".to_string());
    }
    log_plugin_playback(
        "plugin_http_request_backend request",
        json!({
            "method": method,
            "url": redact_sensitive_url(&url),
            "headers": redact_http_headers(headers.as_ref()),
            "bodyBytes": data.as_ref().map(|value| value.len()).unwrap_or(0),
        }),
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(PLUGIN_HTTP_TIMEOUT)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")
        .build()
        .map_err(|err| err.to_string())?;
    let request_method = method
        .parse::<reqwest::Method>()
        .map_err(|err| err.to_string())?;
    let mut request = client.request(request_method, &url);

    for (name, value) in headers.unwrap_or_default() {
        if name.eq_ignore_ascii_case("accept-encoding") {
            continue;
        }
        request = request.header(name, value);
    }

    if let Some(body) = data {
        request = request.body(body);
    }

    let response = request.send().map_err(|err| {
        log_plugin_playback(
            "plugin_http_request_backend error",
            json!({
                "method": method,
                "url": url,
                "error": err.to_string(),
            }),
        );
        err.to_string()
    })?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.as_str().to_string(), value.to_string()))
        })
        .collect::<HashMap<_, _>>();
    let body = response.text().map_err(|err| err.to_string())?;
    log_plugin_playback(
        "plugin_http_request_backend response",
        json!({
            "method": method,
            "url": url,
            "status": status,
            "bodyBytes": body.len(),
        }),
    );

    Ok(PluginHttpResponse {
        status,
        headers,
        body,
    })
}

fn redact_http_headers(headers: Option<&HashMap<String, String>>) -> Value {
    Value::Object(
        headers
            .into_iter()
            .flat_map(|headers| headers.iter())
            .map(|(name, value)| {
                let redacted = if is_sensitive_header(name) {
                    "***".to_string()
                } else {
                    value.clone()
                };
                (name.clone(), Value::String(redacted))
            })
            .collect(),
    )
}

fn redact_sensitive_url(url: &str) -> String {
    let Some((base, query)) = url.split_once('?') else {
        return url.to_string();
    };
    let redacted_query = query
        .split('&')
        .map(|part| {
            let Some((name, value)) = part.split_once('=') else {
                return part.to_string();
            };
            if is_sensitive_query_name(name) {
                format!("{name}=***")
            } else {
                format!("{name}={value}")
            }
        })
        .collect::<Vec<_>>()
        .join("&");
    format!("{base}?{redacted_query}")
}

fn is_sensitive_query_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name == "key"
        || name == "vkey"
        || name.contains("apikey")
        || name.contains("api_key")
        || name.contains("token")
        || name.contains("secret")
}

fn is_sensitive_header(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name == "authorization"
        || name == "cookie"
        || name == "set-cookie"
        || name.contains("api-key")
        || name.contains("token")
        || name.contains("secret")
}

#[cfg(test)]
mod tests {
    #[test]
    fn actual_quality_falls_back_to_response_quality() {
        let plugin = serde_json::from_value(serde_json::json!({"id":"provider","name":"Provider","enabled":true,"capabilities":["play"]})).unwrap();
        for actual in [serde_json::Value::Null, serde_json::json!(""), serde_json::json!("  "), serde_json::json!("standard")] {
            let result = super::normalize_plugin_playback_source(serde_json::json!({"url":"https://audio.test/song","quality":"lossless","actualQuality":actual}), "high", &serde_json::json!({}), &plugin).unwrap();
            assert_eq!(result.quality, "lossless");
            assert_eq!(result.actual_quality.as_deref(), Some(actual.as_str().map(str::trim).filter(|s| !s.is_empty()).unwrap_or("lossless")));
        }
    }

    use super::*;
    use serde_json::json;


    #[test]
    fn json_year_value_ignores_non_ascii_text_without_panicking() {
        assert_eq!(json_year_value(&json!("·òÆÞÄÇÐ©ÊÂ µçÊÓ¾çÔÉù´ø")), None);
    }

    #[test]
    fn json_year_value_finds_year_inside_text() {
        assert_eq!(json_year_value(&json!("发行时间：2024-05-01")), Some(2024));
    }
}
