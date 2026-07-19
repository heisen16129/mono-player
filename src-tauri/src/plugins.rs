use crate::api_response::ApiResponse;
use serde_json::json;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const PLUGIN_HTTP_TIMEOUT: Duration = Duration::from_secs(8);
static PLAYBACK_QUALITIES_GENERATION: AtomicU64 = AtomicU64::new(0);

fn log_plugin_playback(method: &str, args: serde_json::Value) {
    eprintln!("[plugin-playback] {method} args={args}");
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
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPlaybackPlan {
    plugin_id: String,
    plugin_name: String,
    qualities: Vec<String>,
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSearchTrack {
    id: String,
    provider_id: String,
    provider_name: String,
    title: String,
    artist: String,
    album: String,
    duration: Option<u64>,
    artwork: Option<String>,
    year: Option<u64>,
    genre: Option<String>,
    track_number: Option<u64>,
    raw: serde_json::Value,
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
    pub(crate) source_id: String,
    pub(crate) source_name: String,
    pub(crate) source_provider_id: String,
    pub(crate) source_raw: serde_json::Value,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLyricsMetadata {
    pub(crate) raw_lyrics: Option<String>,
    pub(crate) lyrics_url: Option<String>,
    pub(crate) formats: Vec<String>,
    pub(crate) default_format: Option<String>,
    pub(crate) format: Option<String>,
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
    author: Option<String>,
    description: Option<String>,
    capabilities: Vec<String>,
    permissions: Vec<String>,
    source_url: String,
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
    author: Option<String>,
    description: Option<String>,
    capabilities: Vec<String>,
    permissions: Vec<String>,
    source_url: Option<String>,
    installed_at: String,
    enabled: bool,
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
    capabilities: Option<Vec<String>>,
    permissions: Option<Vec<String>>,
}

#[tauri::command]
pub fn plugin_invoke(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    entry: String,
    request: serde_json::Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
) -> ApiResponse<serde_json::Value> {
    ApiResponse::from_result(
        worker
            .invoke_plugin(entry, request, plugin_id, permissions)
            .and_then(unwrap_plugin_response_envelope),
    )
}

#[tauri::command]
pub fn normalize_plugin_manifests(plugins: Vec<serde_json::Value>) -> ApiResponse<Vec<PluginManifest>> {
    ApiResponse::success(plugins
        .into_iter()
        .filter_map(normalize_plugin_manifest_value)
        .collect())
}

#[tauri::command]
pub fn normalize_plugin_catalog_items(plugins: Vec<serde_json::Value>) -> ApiResponse<Vec<PluginCatalogItem>> {
    ApiResponse::success(normalize_catalog_values(plugins))
}

#[tauri::command]
pub fn normalize_plugin_catalog_text(catalog_text: String) -> ApiResponse<Vec<PluginCatalogItem>> {
    ApiResponse::from_result((|| {
        let catalog = serde_json::from_str::<Value>(&catalog_text).map_err(|err| err.to_string())?;
        Ok(normalize_catalog_values(catalog_values(catalog)))
    })())
}

#[tauri::command]
pub fn fetch_plugin_catalog_items(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    url: String,
) -> ApiResponse<Vec<PluginCatalogItem>> {
    ApiResponse::from_result(fetch_plugin_catalog_items_inner(worker, url))
}

fn fetch_plugin_catalog_items_inner(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    url: String,
) -> Result<Vec<PluginCatalogItem>, String> {
    if is_direct_plugin_url(&url) {
        return build_plugin_catalog_item_from_entry(&worker, url.clone(), url).map(|item| vec![item]);
    }

    let catalog_text = fetch_plugin_catalog_backend(url)?;
    let catalog = serde_json::from_str::<Value>(&catalog_text).map_err(|err| err.to_string())?;
    catalog_values(catalog)
        .into_iter()
        .map(|value| {
            let source_url = catalog_item_source_url(&value)?;
            let entry = string_field(&value, &["entry"]).unwrap_or_else(|| source_url.clone());
            build_plugin_catalog_item_from_entry(&worker, entry, source_url)
        })
        .collect()
}

#[tauri::command]
pub fn read_plugin_metadata_normalized(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    entry: String,
    permissions: Option<Vec<String>>,
) -> ApiResponse<PluginMetadata> {
    ApiResponse::from_result(read_plugin_metadata_backend(&worker, entry, permissions))
}

#[tauri::command]
pub fn build_plugin_manifest_from_catalog(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    item: PluginCatalogItem,
    installed_at: String,
    enabled: bool,
) -> ApiResponse<PluginManifest> {
    ApiResponse::from_result(build_plugin_manifest_from_catalog_inner(worker, item, installed_at, enabled))
}

fn build_plugin_manifest_from_catalog_inner(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    item: PluginCatalogItem,
    installed_at: String,
    enabled: bool,
) -> Result<PluginManifest, String> {
    let metadata = read_plugin_metadata_backend(
        &worker,
        item.entry.clone(),
        Some(item.permissions.clone()),
    )?;

    Ok(PluginManifest {
        id: required_metadata_field(metadata.id, "id")?,
        name: required_metadata_field(metadata.name, "name")?,
        version: required_metadata_field(metadata.version, "version")?,
        kind: required_metadata_field(metadata.kind, "kind")?,
        runtime: "wasm".to_string(),
        entry: item.entry,
        author: metadata.author,
        description: metadata.description,
        capabilities: required_metadata_list(metadata.capabilities, "capabilities")?,
        permissions: metadata.permissions.unwrap_or_default(),
        source_url: Some(item.source_url),
        installed_at,
        enabled,
    })
}

#[tauri::command]
pub fn build_local_plugin_manifest(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    file_path: String,
    installed_at: String,
    enabled: bool,
) -> ApiResponse<PluginManifest> {
    ApiResponse::from_result(build_local_plugin_manifest_inner(worker, file_path, installed_at, enabled))
}

fn build_local_plugin_manifest_inner(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    file_path: String,
    installed_at: String,
    enabled: bool,
) -> Result<PluginManifest, String> {
    if !is_direct_plugin_url(&file_path) {
        return Err("local plugin entry must be a .wasm file".to_string());
    }

    let metadata = read_plugin_metadata_backend(&worker, file_path.clone(), None)?;

    Ok(PluginManifest {
        id: required_metadata_field(metadata.id, "id")?,
        name: required_metadata_field(metadata.name, "name")?,
        version: required_metadata_field(metadata.version, "version")?,
        kind: required_metadata_field(metadata.kind, "kind")?,
        runtime: "wasm".to_string(),
        entry: file_path.clone(),
        author: metadata.author,
        description: metadata.description,
        capabilities: required_metadata_list(metadata.capabilities, "capabilities")?,
        permissions: metadata.permissions.unwrap_or_default(),
        source_url: Some(file_path),
        installed_at,
        enabled,
    })
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
        json!({
            "action": "search",
            "keyword": query,
            "page": page.max(1),
            "pageSize": page_size.clamp(1, 100),
        }),
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;

    normalize_plugin_search_page(unwrap_plugin_response_envelope(response)?, &plugin)
}

#[tauri::command]
pub fn resolve_plugin_playback_plan(
    provider_id: String,
    preferred_quality: String,
    _quality_fallback: String,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> ApiResponse<PluginPlaybackPlan> {
    ApiResponse::from_result(resolve_plugin_playback_plan_inner(provider_id, preferred_quality, plugins))
}

fn resolve_plugin_playback_plan_inner(
    provider_id: String,
    preferred_quality: String,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackPlan, String> {
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

    Ok(PluginPlaybackPlan {
        plugin_id: plugin.id,
        plugin_name: plugin.name,
        qualities: vec![preferred_quality],
    })
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
    resolve_plugin_playback_qualities_backend_checked(worker, provider_id, track, plugins, true, should_continue)
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
    let plugin_track = track.get("raw").cloned().unwrap_or(track);
    let request = json!({
        "action": "qualities",
        "track": plugin_track,
    });

    let response = invoke_playback_plugin(
        worker,
        entry,
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        wait_for_ready,
        &mut should_continue,
    )?;

    normalize_plugin_playback_qualities(unwrap_plugin_response_envelope(response)?)
}

pub(crate) fn resolve_plugin_playback_source_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    preferred_quality: Option<String>,
    _quality_fallback: String,
    include_metadata: bool,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackSource, String> {
    resolve_plugin_playback_source_backend_checked(
        worker,
        provider_id,
        track,
        preferred_quality,
        _quality_fallback,
        include_metadata,
        plugins,
        false,
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
    let plugin_track = track.get("raw").cloned().unwrap_or(track);
    let mut last_error = None;
    let qualities = resolve_playback_quality_attempts(
        &worker,
        &entry,
        &plugin,
        &plugin_track,
        preferred_quality.as_deref(),
        wait_for_ready,
        &mut should_continue,
    )?;

    for quality in qualities {
        let request = json!({
            "action": "play",
            "track": plugin_track.clone(),
            "quality": quality,
            "includeMetadata": include_metadata,
        });
        log_plugin_playback(
            "resolve_plugin_playback_source request",
            json!({
                "providerId": plugin.id,
                "entry": entry,
                "request": request.clone(),
            }),
        );

        let response = invoke_playback_plugin(
            worker,
            entry.clone(),
            request,
            Some(plugin.id.clone()),
            plugin.permissions.clone(),
            wait_for_ready,
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
                match unwrap_plugin_response_envelope(response)
                    .and_then(|data| normalize_plugin_playback_source(data, &quality, &plugin_track, &plugin))
                {
                    Ok(mut source) => {
                        if include_metadata && playback_source_needs_lyrics(&source) {
                            source.lyrics = resolve_playback_lyrics_metadata(
                                &worker,
                                &entry,
                                &plugin,
                                &plugin_track,
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
    format: Option<String>,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<ApiResponse<PluginLyricsMetadata>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_lyrics_metadata_backend(&worker, provider_id, track, format, plugins)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

pub(crate) fn resolve_plugin_lyrics_metadata_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    format: Option<String>,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginLyricsMetadata, String> {
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
        .ok_or_else(|| "Plugin for selected track is missing an entry.".to_string())?;
    let plugin_track = track.get("raw").cloned().unwrap_or(track);
    let format = normalize_lyrics_format(format.as_deref());
    let request = json!({
        "action": "lyrics",
        "format": format,
        "track": plugin_track,
    });

    let response = worker.invoke_plugin(
        entry,
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;

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
    let artist = json_string_field(track, &["artist", "singer", "author"])
        .unwrap_or("")
        .to_string();
    let album = json_string_field(track, &["album", "albumName"])
        .unwrap_or("")
        .to_string();
    let duration = json_duration_seconds(track);
    let source_id = json_string_field(track, &["id", "songmid", "mid", "hash"])
        .unwrap_or("")
        .to_string();

    Ok(PluginPlaybackSource {
        path: url.clone(),
        url,
        title,
        artist,
        album,
        duration,
        artwork,
        lyrics,
        quality,
        source_id,
        source_name: plugin.name.clone(),
        source_provider_id: plugin.id.clone(),
        source_raw: track.clone(),
    })
}

fn playback_source_needs_lyrics(source: &PluginPlaybackSource) -> bool {
    source
        .lyrics
        .as_ref()
        .and_then(|lyrics| lyrics.raw_lyrics.as_deref())
        .map(str::trim)
        .filter(|lyrics| !lyrics.is_empty())
        .is_none()
}

fn lyrics_metadata_has_content(lyrics: &PluginLyricsMetadata) -> bool {
    lyrics
        .raw_lyrics
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
        || lyrics
            .lyrics_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_some()
        || !lyrics.formats.is_empty()
        || lyrics.default_format.is_some()
        || lyrics.format.is_some()
}

fn resolve_playback_lyrics_metadata(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: &str,
    plugin: &PluginPlaybackPlanPlugin,
    track: &serde_json::Value,
) -> Result<PluginLyricsMetadata, String> {
    if !plugin
        .capabilities
        .iter()
        .any(|capability| capability == "lyrics")
    {
        return Err("Plugin does not support lyrics.".to_string());
    }

    let request = json!({
        "action": "lyrics",
        "track": track,
    });
    let response = worker.invoke_plugin(
        entry.to_string(),
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;
    normalize_plugin_lyrics_metadata(unwrap_plugin_response_envelope(response)?)
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
        .map(|track| normalize_plugin_search_track(track, plugin))
        .collect::<Vec<_>>();
    let is_end = response
        .get("isEnd")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(tracks.is_empty());

    Ok(PluginSearchPage { tracks, is_end })
}

fn normalize_plugin_search_track(
    track: serde_json::Value,
    plugin: &PluginPlaybackPlanPlugin,
) -> PluginSearchTrack {
    let raw = track.get("raw").cloned().unwrap_or_else(|| track.clone());
    let title = json_string_field(&track, &["title", "name"])
        .unwrap_or("Unknown Track")
        .to_string();
    let id = json_search_id(&track)
        .unwrap_or_else(|| format!("{}:{}", plugin.id, title));

    PluginSearchTrack {
        id,
        provider_id: plugin.id.clone(),
        provider_name: plugin.name.clone(),
        title,
        artist: json_search_artist(&track).unwrap_or_else(|| "Unknown Artist".to_string()),
        album: json_string_field(&track, &["album", "albumName"])
            .unwrap_or("")
            .to_string(),
        duration: json_search_duration_seconds(&track),
        artwork: json_string_field(&track, &["artwork", "cover", "picUrl"]).map(str::to_string),
        year: json_search_year(&track),
        genre: json_string_field(&track, &["genre", "style"]).map(str::to_string),
        track_number: json_search_positive_integer(&track, &["trackNumber", "trackNo", "track_no", "index"]),
        raw,
    }
}

fn json_search_id(value: &serde_json::Value) -> Option<String> {
    ["id", "songmid", "mid", "hash"]
        .iter()
        .find_map(|key| value.get(*key))
        .and_then(json_value_to_string)
        .filter(|value| !value.trim().is_empty())
}

fn json_search_artist(value: &serde_json::Value) -> Option<String> {
    if let Some(artist) = json_string_field(value, &["artist", "singer", "author"])
        .map(str::trim)
        .filter(|artist| !artist.is_empty())
    {
        return Some(artist.to_string());
    }

    let artists = value.get("artists")?.as_array()?;
    let names = artists
        .iter()
        .filter_map(|artist| {
            artist
                .as_str()
                .or_else(|| artist.get("name").and_then(serde_json::Value::as_str))
        })
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>();
    if names.is_empty() {
        None
    } else {
        Some(names.join(", "))
    }
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
        ["duration_ms", "interval_ms"]
            .iter()
            .find_map(|key| value.get(*key).and_then(json_numeric_value).map(|ms| (ms / 1000.0).round() as u64))
    })
}

fn json_duration_value_seconds(value: &serde_json::Value) -> Option<u64> {
    if let Some(number) = json_numeric_value(value) {
        return Some(if number > 1000.0 { (number / 1000.0).round() as u64 } else { number.round() as u64 });
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
    for index in 0..text.len().saturating_sub(3) {
        let candidate = &text[index..index + 4];
        if let Ok(year) = candidate.parse::<u64>() {
            if (1900..=2099).contains(&year) {
                return Some(year);
            }
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

fn catalog_item_source_url(value: &Value) -> Result<String, String> {
    let source_url = string_field(value, &["url", "entry"])
        .ok_or_else(|| "plugin catalog item missing url".to_string())?;
    if !is_direct_plugin_url(&source_url) {
        return Err("plugin catalog item url must point to a .wasm file".to_string());
    }
    Ok(source_url)
}

fn normalize_catalog_item_value(value: Value) -> Option<PluginCatalogItem> {
    let source_url = catalog_item_source_url(&value).ok()?;
    let name = string_field(&value, &["name"])?;
    let capabilities = normalize_capabilities(array_string_field(&value, "capabilities")?)?;

    Some(PluginCatalogItem {
        id: string_field(&value, &["id"] )?,
        name,
        version: string_field(&value, &["version"] )?,
        kind: normalize_kind(string_field(&value, &["kind"] )?)?,
        runtime: normalize_runtime(string_field(&value, &["runtime"])).unwrap_or_else(|| "wasm".to_string()),
        entry: string_field(&value, &["entry"]).unwrap_or_else(|| source_url.clone()),
        author: string_field(&value, &["author"]),
        description: string_field(&value, &["description"]),
        capabilities,
        permissions: normalize_permissions(array_string_field(&value, "permissions").unwrap_or_default()).ok()?,
        source_url,
    })
}

fn normalize_plugin_manifest_value(value: Value) -> Option<PluginManifest> {
    let entry = string_field(&value, &["entry"])?;
    if !is_direct_plugin_url(&entry) {
        return None;
    }
    let name = string_field(&value, &["name"])?;
    let source_url = string_field(&value, &["sourceUrl", "source_url"]);
    let capabilities = normalize_capabilities(array_string_field(&value, "capabilities")?)?;

    Some(PluginManifest {
        id: string_field(&value, &["id"] )?,
        name,
        version: string_field(&value, &["version"] )?,
        kind: normalize_kind(string_field(&value, &["kind"] )?)?,
        runtime: normalize_runtime(string_field(&value, &["runtime"])).unwrap_or_else(|| "wasm".to_string()),
        entry,
        author: string_field(&value, &["author"]),
        description: string_field(&value, &["description"]),
        capabilities,
        permissions: normalize_permissions(array_string_field(&value, "permissions").unwrap_or_default()).ok()?,
        source_url,
        installed_at: string_field(&value, &["installedAt", "installed_at"]).unwrap_or_default(),
        enabled: value.get("enabled").and_then(Value::as_bool).unwrap_or(true),
    })
}

fn build_plugin_catalog_item_from_entry(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: String,
    source_url: String,
) -> Result<PluginCatalogItem, String> {
    let metadata = read_plugin_metadata_backend(worker, entry.clone(), None)?;
    Ok(PluginCatalogItem {
        id: required_metadata_field(metadata.id, "id")?,
        name: required_metadata_field(metadata.name, "name")?,
        version: required_metadata_field(metadata.version, "version")?,
        kind: required_metadata_field(metadata.kind, "kind")?,
        runtime: "wasm".to_string(),
        entry,
        author: metadata.author,
        description: metadata.description,
        capabilities: required_metadata_list(metadata.capabilities, "capabilities")?,
        permissions: metadata.permissions.unwrap_or_default(),
        source_url,
    })
}

fn read_plugin_metadata_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: String,
    permissions: Option<Vec<String>>,
) -> Result<PluginMetadata, String> {
    worker
        .invoke_plugin(
            entry,
            json!({ "action": "metadata" }),
            None,
            permissions.map(normalize_permissions).transpose()?,
        )
        .and_then(unwrap_plugin_response_envelope)
        .and_then(|value| serde_json::from_value::<PluginMetadata>(value).map_err(|err| err.to_string()))
        .and_then(normalize_plugin_metadata)
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
        .unwrap_or(if code == 1 { "plugin call succeeded" } else { "plugin call failed" });

    if code != 1 {
        return Err(message.to_string());
    }

    response
        .get("data")
        .cloned()
        .filter(|value| !value.is_null())
        .ok_or_else(|| "plugin ApiResponse success missing data".to_string())
}

fn normalize_plugin_metadata(metadata: PluginMetadata) -> Result<PluginMetadata, String> {
    Ok(PluginMetadata {
        id: Some(required_metadata_field(metadata.id, "id")?),
        name: Some(required_metadata_field(metadata.name, "name")?),
        version: Some(required_metadata_field(metadata.version, "version")?),
        kind: Some(normalize_kind(required_metadata_field(metadata.kind, "kind")?)
            .ok_or_else(|| "plugin metadata kind must be music or lyrics".to_string())?),
        author: metadata.author.and_then(non_empty_string),
        description: metadata.description.and_then(non_empty_string),
        capabilities: Some(normalize_capabilities(required_metadata_list(metadata.capabilities, "capabilities")?)
            .ok_or_else(|| "plugin metadata capabilities cannot be empty".to_string())?),
        permissions: Some(normalize_permissions(metadata.permissions.unwrap_or_default())?),
    })
}

fn required_metadata_field(value: Option<String>, field: &str) -> Result<String, String> {
    value
        .and_then(non_empty_string)
        .ok_or_else(|| format!("plugin metadata missing {field}"))
}

fn required_metadata_list(value: Option<Vec<String>>, field: &str) -> Result<Vec<String>, String> {
    let items = value.unwrap_or_default();
    if items.is_empty() {
        Err(format!("plugin metadata missing {field}"))
    } else {
        Ok(items)
    }
}

fn normalize_runtime(runtime: Option<String>) -> Option<String> {
    match runtime.as_deref().map(str::trim) {
        Some("wasm") => Some("wasm".to_string()),
        _ => None,
    }
}

fn normalize_kind(kind: String) -> Option<String> {
    match kind.trim() {
        "music" | "lyrics" => Some(kind.trim().to_string()),
        _ => None,
    }
}

fn normalize_capabilities(capabilities: Vec<String>) -> Option<Vec<String>> {
    let normalized = capabilities
        .into_iter()
        .filter_map(|capability| normalize_capability(&capability))
        .fold(Vec::<String>::new(), |mut items, capability| {
            if !items.contains(&capability) {
                items.push(capability);
            }
            items
        });
    if normalized.is_empty() { None } else { Some(normalized) }
}

fn normalize_capability(capability: &str) -> Option<String> {
    match capability.trim() {
        "search" | "play" | "lyrics" => Some(capability.trim().to_string()),
        _ => None,
    }
}

fn normalize_permissions(permissions: Vec<String>) -> Result<Vec<String>, String> {
    Ok(permissions
        .into_iter()
        .map(|permission| normalize_permission(&permission)
            .ok_or_else(|| format!("unsupported plugin permission: {permission}")))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .fold(Vec::<String>::new(), |mut items, permission| {
            if !items.contains(&permission) {
                items.push(permission);
            }
            items
        }))
}

fn normalize_permission(permission: &str) -> Option<String> {
    match permission.trim() {
        "network" | "credential-read" | "cache-read" | "cache-write" | "download-write" => {
            Some(permission.trim().to_string())
        }
        _ => None,
    }
}

fn is_direct_plugin_url(value: &str) -> bool {
    value.split('?').next().unwrap_or(value).to_ascii_lowercase().ends_with(".wasm")
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

fn non_empty_string(value: String) -> Option<String> {
    let value = value.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
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

    let lyrics_url = json_string_field(&response, &["lyricsUrl", "lyricUrl", "lrcUrl"])
        .map(|value| value.to_string());
    let raw_lyrics = resolve_raw_lyrics(&response)?;
    let formats = normalize_lyrics_formats(response.get("formats"));
    let default_format = json_string_field(&response, &["defaultFormat"])
        .and_then(|value| normalize_lyrics_format(Some(value)));
    let format = json_string_field(&response, &["format"])
        .and_then(|value| normalize_lyrics_format(Some(value)))
        .or_else(|| default_format.clone());

    Ok(PluginLyricsMetadata {
        raw_lyrics,
        lyrics_url,
        formats,
        default_format,
        format,
    })
}

fn normalize_lyrics_format(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    match value {
        "lrc" | "trans" | "yrc" | "qrc" | "krc" | "a2" => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_lyrics_formats(value: Option<&Value>) -> Vec<String> {
    let Some(items) = value.and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut formats = Vec::new();
    for item in items {
        let Some(format) = item
            .as_str()
            .and_then(|value| normalize_lyrics_format(Some(value)))
        else {
            continue;
        };
        if !formats.contains(&format) {
            formats.push(format);
        }
    }
    formats
}

fn resolve_raw_lyrics(response: &Value) -> Result<Option<String>, String> {
    let raw_lyrics = json_string_field(
        response,
        &["rawLyrics", "rawLrc", "rawLrcTxt", "lyric", "lyrics", "lrc"],
    )
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(|value| value.to_string());
    if raw_lyrics.is_some() {
        return Ok(raw_lyrics);
    }

    let Some(lyrics_url) = json_string_field(response, &["lyricsUrl", "lyricUrl", "lrcUrl"])
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    fetch_raw_lyrics_from_url(lyrics_url).map(Some)
}

fn fetch_raw_lyrics_from_url(url: &str) -> Result<String, String> {
    crate::lyrics::fetch_lyrics_url_text(url)
}

fn invoke_playback_plugin<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: String,
    request: serde_json::Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
    wait_for_ready: bool,
    should_continue: &mut F,
) -> Result<serde_json::Value, String>
where
    F: FnMut() -> Result<(), String>,
{
    if wait_for_ready {
        worker.invoke_plugin_when_ready(entry, request, plugin_id, permissions, should_continue)
    } else {
        worker.invoke_plugin(entry, request, plugin_id, permissions)
    }
}

fn resolve_playback_quality_attempts<F>(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: &str,
    plugin: &PluginPlaybackPlanPlugin,
    track: &serde_json::Value,
    preferred_quality: Option<&str>,
    wait_for_ready: bool,
    should_continue: &mut F,
) -> Result<Vec<String>, String>
where
    F: FnMut() -> Result<(), String>,
{
    let request = json!({
        "action": "qualities",
        "track": track,
    });
    let response = invoke_playback_plugin(
        worker,
        entry.to_string(),
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
        wait_for_ready,
        should_continue,
    )?;
    let qualities = normalize_plugin_playback_qualities(unwrap_plugin_response_envelope(response)?)?;

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

#[tauri::command]
pub fn fetch_plugin_catalog(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    url: String,
) -> ApiResponse<String> {
    ApiResponse::from_result(worker.fetch_plugin_catalog(url))
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

#[tauri::command]
pub fn read_plugin_wasm_bytes(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    entry: String,
) -> ApiResponse<Vec<u8>> {
    ApiResponse::from_result(worker.read_plugin_wasm_bytes(entry))
}

pub(crate) fn read_plugin_wasm_bytes_backend(entry: String) -> Result<Vec<u8>, String> {
    if entry.starts_with("https://") || entry.starts_with("http://") {
        let client = reqwest::blocking::Client::builder()
            .timeout(PLUGIN_HTTP_TIMEOUT)
            .user_agent("Mono Player/0.1.0")
            .build()
            .map_err(|err| err.to_string())?;

        let response = client.get(entry).send().map_err(|err| err.to_string())?;
        let status = response.status();
        if !status.is_success() {
            return Err(format!("HTTP {}", status.as_u16()));
        }

        return response
            .bytes()
            .map(|bytes| bytes.to_vec())
            .map_err(|err| err.to_string());
    }

    let path = resolve_local_plugin_wasm_path(&entry);
    fs::read(&path).map_err(|err| format!("{}: {}", path.display(), err))
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

#[tauri::command]
pub fn plugin_http_request(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    data: Option<String>,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
) -> ApiResponse<PluginHttpResponse> {
    ApiResponse::from_result(worker.plugin_http_request(method, url, headers, data, plugin_id, permissions))
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
            "url": url,
            "headers": headers,
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
