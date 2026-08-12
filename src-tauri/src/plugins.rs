use crate::api_response::ApiResponse;
use serde_json::json;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

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
}

pub(crate) fn playback_plugins_from_values(
    plugins: Value,
    configs: Option<Value>,
) -> Result<Vec<PluginPlaybackPlanPlugin>, String> {
    let mut plugins = serde_json::from_value::<Vec<PluginPlaybackPlanPlugin>>(plugins)
        .map_err(|err| err.to_string())?;
    attach_plugin_configs(&mut plugins, configs.as_ref().unwrap_or(&Value::Null));
    Ok(plugins)
}

fn attach_plugin_configs(plugins: &mut [PluginPlaybackPlanPlugin], configs: &Value) {
    for plugin in plugins {
        let mut config = default_config_from_schema(plugin.config_schema.as_ref());
        merge_config_value(&mut config, plugin.config.as_ref());
        merge_config_value(&mut config, configs.get(&plugin.id));
        plugin.config = if config.as_object().map(|object| object.is_empty()).unwrap_or(true) {
            None
        } else {
            Some(config)
        };
    }
}

fn default_config_from_schema(schema: Option<&Value>) -> Value {
    let mut config = serde_json::Map::new();
    for field in schema
        .and_then(|schema| schema.get("fields"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let Some(key) = field.get("key").and_then(Value::as_str).map(str::trim).filter(|key| !key.is_empty()) else {
            continue;
        };
        if let Some(value) = field.get("defaultValue").and_then(normalize_config_default_value) {
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
    pub(crate) source_id: String,
    pub(crate) source_name: String,
    pub(crate) source_provider_id: String,
    pub(crate) source_raw: serde_json::Value,
}

#[derive(serde::Serialize)]
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

#[derive(Clone, Debug, serde::Serialize)]
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
pub fn normalize_plugin_manifests(
    plugins: Vec<serde_json::Value>,
) -> ApiResponse<Vec<PluginManifest>> {
    ApiResponse::success(
        plugins
            .into_iter()
            .filter_map(normalize_plugin_manifest_value)
            .collect(),
    )
}

#[tauri::command]
pub fn normalize_plugin_catalog_items(
    plugins: Vec<serde_json::Value>,
) -> ApiResponse<Vec<PluginCatalogItem>> {
    ApiResponse::success(normalize_catalog_values(plugins))
}

#[tauri::command]
pub fn normalize_plugin_catalog_text(catalog_text: String) -> ApiResponse<Vec<PluginCatalogItem>> {
    ApiResponse::from_result((|| {
        let catalog =
            serde_json::from_str::<Value>(&catalog_text).map_err(|err| err.to_string())?;
        Ok(normalize_catalog_values(catalog_values(catalog)))
    })())
}

#[tauri::command]
pub async fn fetch_plugin_catalog_items(
    app: AppHandle,
    url: String,
) -> Result<ApiResponse<Vec<PluginCatalogItem>>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        fetch_plugin_catalog_items_inner(&worker, url)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

fn fetch_plugin_catalog_items_inner(
    worker: &crate::workers::plugin::PluginWorkerState,
    url: String,
) -> Result<Vec<PluginCatalogItem>, String> {
    if is_direct_plugin_url(&url) {
        return build_plugin_catalog_item_from_entry(worker, url.clone(), url)
            .map(|item| vec![item]);
    }

    let catalog_text = fetch_plugin_catalog_backend(url)?;
    let catalog = serde_json::from_str::<Value>(&catalog_text).map_err(|err| err.to_string())?;
    Ok(normalize_catalog_values(catalog_values(catalog)))
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
pub async fn build_plugin_manifest_from_catalog(
    app: AppHandle,
    item: PluginCatalogItem,
    installed_at: String,
    enabled: bool,
) -> Result<ApiResponse<PluginManifest>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        build_plugin_manifest_from_catalog_inner(&app, &worker, item, installed_at, enabled)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

fn build_plugin_manifest_from_catalog_inner(
    app: &AppHandle,
    worker: &crate::workers::plugin::PluginWorkerState,
    item: PluginCatalogItem,
    installed_at: String,
    enabled: bool,
) -> Result<PluginManifest, String> {
    worker.refresh_plugin_wasm_cache(item.entry.clone())?;

    let metadata =
        read_plugin_metadata_backend(&worker, item.entry.clone(), Some(item.permissions.clone()))?;

    let capabilities = required_metadata_list(metadata.capabilities, "capabilities")?;
    let id = required_metadata_field(metadata.id, "id")?;
    let entry = install_plugin_wasm_package(app, &id, &item.entry)?;
    Ok(PluginManifest {
        id,
        name: required_metadata_field(metadata.name, "name")?,
        version: required_metadata_field(metadata.version, "version")?,
        kind: required_metadata_field(metadata.kind, "kind")?,
        runtime: "wasm".to_string(),
        entry,
        author: required_metadata_field(metadata.author, "author")?,
        description: required_metadata_field(metadata.description, "description")?,
        icon: metadata.icon,
        updated_at: required_metadata_field(metadata.updated_at, "updatedAt")?,
        tags: plugin_capability_tags(&capabilities),
        highlights: metadata.highlights.unwrap_or_default(),
        screenshots: metadata.screenshots.unwrap_or_default(),
        capabilities,
        permissions: metadata.permissions.unwrap_or_default(),
        config_schema: metadata.config_schema,
        source_url: Some(item.source_url),
        source_kind: item.source_kind,
        installed_at,
        enabled,
    })
}

#[tauri::command]
pub async fn build_local_plugin_manifest(
    app: AppHandle,
    file_path: String,
    installed_at: String,
    enabled: bool,
) -> Result<ApiResponse<PluginManifest>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        build_local_plugin_manifest_inner(&app, &worker, file_path, installed_at, enabled)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

fn build_local_plugin_manifest_inner(
    app: &AppHandle,
    worker: &crate::workers::plugin::PluginWorkerState,
    file_path: String,
    installed_at: String,
    enabled: bool,
) -> Result<PluginManifest, String> {
    if !is_direct_plugin_url(&file_path) {
        return Err("local plugin entry must be a .wasm file".to_string());
    }

    let metadata = read_plugin_metadata_backend(&worker, file_path.clone(), None)?;

    let capabilities = required_metadata_list(metadata.capabilities, "capabilities")?;
    let id = required_metadata_field(metadata.id, "id")?;
    let entry = install_plugin_wasm_package(app, &id, &file_path)?;
    Ok(PluginManifest {
        id,
        name: required_metadata_field(metadata.name, "name")?,
        version: required_metadata_field(metadata.version, "version")?,
        kind: required_metadata_field(metadata.kind, "kind")?,
        runtime: "wasm".to_string(),
        entry,
        author: required_metadata_field(metadata.author, "author")?,
        description: required_metadata_field(metadata.description, "description")?,
        icon: metadata.icon,
        updated_at: required_metadata_field(metadata.updated_at, "updatedAt")?,
        tags: plugin_capability_tags(&capabilities),
        highlights: metadata.highlights.unwrap_or_default(),
        screenshots: metadata.screenshots.unwrap_or_default(),
        capabilities,
        permissions: metadata.permissions.unwrap_or_default(),
        config_schema: metadata.config_schema,
        source_url: Some(file_path),
        source_kind: "local".to_string(),
        installed_at,
        enabled,
    })
}

#[tauri::command]
pub fn remove_plugin_package(app: AppHandle, plugin_id: String) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let path = plugin_package_dir(&app, &plugin_id)?;
        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|err| err.to_string())?;
        }
        Ok(())
    })())
}

fn install_plugin_wasm_package(
    app: &AppHandle,
    plugin_id: &str,
    source_entry: &str,
) -> Result<String, String> {
    let package_dir = plugin_package_dir(app, plugin_id)?;
    fs::create_dir_all(&package_dir).map_err(|err| err.to_string())?;
    let wasm_path = package_dir.join("plugin.wasm");
    let bytes = read_plugin_wasm_bytes_backend(source_entry.to_string(), None, true)?;
    fs::write(&wasm_path, bytes).map_err(|err| err.to_string())?;
    Ok(wasm_path.to_string_lossy().to_string())
}

fn plugin_package_dir(app: &AppHandle, plugin_id: &str) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join("plugins")
        .join(sanitize_plugin_package_id(plugin_id)))
}

fn sanitize_plugin_package_id(plugin_id: &str) -> String {
    let id = plugin_id
        .chars()
        .map(|character| match character {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => character,
            _ => '_',
        })
        .collect::<String>()
        .trim_matches('.')
        .to_string();
    if id.is_empty() {
        "unknown-plugin".to_string()
    } else {
        id
    }
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
        plugin_request(&plugin, json!({
            "action": "search",
            "keyword": query,
            "page": page.max(1),
            "pageSize": page_size.clamp(1, 100),
        })),
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
    ApiResponse::from_result(resolve_plugin_playback_plan_inner(
        provider_id,
        preferred_quality,
        plugins,
    ))
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
    let request = plugin_request(&plugin, json!({
        "action": "qualities",
        "track": plugin_track,
    }));

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
        let request = plugin_request(&plugin, json!({
            "action": "play",
            "track": plugin_track.clone(),
            "quality": quality,
            "includeMetadata": include_metadata,
        }));
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
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_lyrics_metadata_backend_checked(
            &worker,
            provider_id,
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
        )
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
}

#[tauri::command]
pub async fn resolve_plugin_cover_metadata(
    app: AppHandle,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<ApiResponse<String>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_cover_metadata_backend(&worker, provider_id, track, plugins)
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
    let request = plugin_request(&plugin, json!({
        "action": "cover",
        "track": plugin_track,
    }));
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
    let request = plugin_request(&plugin, json!({
        "action": "lyrics",
        "track": plugin_track,
    }));

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
        quality,
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

    let request = plugin_request(plugin, json!({
        "action": "lyrics",
        "track": track,
    }));
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
    let source_raw = track
        .get("sourceRaw")
        .cloned()
        .unwrap_or_else(|| track.clone());
    let title = json_string_field(&track, &["title", "name"])
        .unwrap_or("Unknown Track")
        .to_string();
    let id = json_search_id(&track).unwrap_or_else(|| format!("{}:{}", plugin.id, title));

    PluginSearchTrack {
        id,
        provider_id: plugin.id.clone(),
        provider_name: plugin.name.clone(),
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

fn normalized_source_kind(value: Option<String>, entry: &str, source_url: Option<&str>) -> String {
    match value.as_deref() {
        Some("official") => "official".to_string(),
        Some("subscription") => "subscription".to_string(),
        Some("local") => "local".to_string(),
        _ => infer_plugin_source_kind(entry, source_url),
    }
}

fn normalize_catalog_item_value(value: Value) -> Option<PluginCatalogItem> {
    let source_url = catalog_item_source_url(&value).ok()?;
    let name = string_field(&value, &["name"])?;
    let capabilities = normalize_capabilities(array_string_field(&value, "capabilities")?)?;
    let entry = string_field(&value, &["entry"]).unwrap_or_else(|| source_url.clone());
    let source_kind = normalized_source_kind(
        string_field(&value, &["sourceKind", "source_kind"]),
        &entry,
        Some(&source_url),
    );

    Some(PluginCatalogItem {
        id: string_field(&value, &["id"])?,
        name,
        version: string_field(&value, &["version"])?,
        kind: normalize_kind(string_field(&value, &["kind"])?)?,
        runtime: normalize_runtime(string_field(&value, &["runtime"]))
            .unwrap_or_else(|| "wasm".to_string()),
        entry,
        author: string_field(&value, &["author"])?,
        description: string_field(&value, &["description"])?,
        icon: string_field(&value, &["icon"]),
        updated_at: string_field(&value, &["updatedAt", "updated_at"])?,
        tags: plugin_capability_tags(&capabilities),
        highlights: normalize_text_list(
            array_string_field(&value, "highlights").unwrap_or_default(),
        ),
        screenshots: normalize_screenshot_list(
            array_string_field(&value, "screenshots").unwrap_or_default(),
        ),
        capabilities,
        permissions: normalize_permissions(
            array_string_field(&value, "permissions").unwrap_or_default(),
        )
        .ok()?,
        source_url,
        source_kind,
        config_schema: normalize_config_schema(value.get("configSchema").or_else(|| value.get("config_schema")).cloned()),
    })
}

fn normalize_plugin_manifest_value(value: Value) -> Option<PluginManifest> {
    let entry = string_field(&value, &["entry"])?;
    if !is_direct_plugin_url(&entry) {
        return None;
    }
    if !entry.starts_with("http://") && !entry.starts_with("https://") && !Path::new(&entry).is_file() {
        return None;
    }
    let name = string_field(&value, &["name"])?;
    let source_url = string_field(&value, &["sourceUrl", "source_url"]);
    let capabilities = normalize_capabilities(array_string_field(&value, "capabilities")?)?;
    let source_kind = normalized_source_kind(
        string_field(&value, &["sourceKind", "source_kind"]),
        &entry,
        source_url.as_deref(),
    );

    Some(PluginManifest {
        id: string_field(&value, &["id"])?,
        name,
        version: string_field(&value, &["version"])?,
        kind: normalize_kind(string_field(&value, &["kind"])?)?,
        runtime: normalize_runtime(string_field(&value, &["runtime"]))
            .unwrap_or_else(|| "wasm".to_string()),
        entry,
        author: string_field(&value, &["author"])?,
        description: string_field(&value, &["description"])?,
        icon: string_field(&value, &["icon"]),
        updated_at: string_field(&value, &["updatedAt", "updated_at"])?,
        tags: plugin_capability_tags(&capabilities),
        highlights: normalize_text_list(
            array_string_field(&value, "highlights").unwrap_or_default(),
        ),
        screenshots: normalize_screenshot_list(
            array_string_field(&value, "screenshots").unwrap_or_default(),
        ),
        capabilities,
        permissions: normalize_permissions(
            array_string_field(&value, "permissions").unwrap_or_default(),
        )
        .ok()?,
        source_url,
        source_kind,
        installed_at: string_field(&value, &["installedAt", "installed_at"]).unwrap_or_default(),
        enabled: value
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        config_schema: normalize_config_schema(value.get("configSchema").or_else(|| value.get("config_schema")).cloned()),
    })
}

fn build_plugin_catalog_item_from_entry(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: String,
    source_url: String,
) -> Result<PluginCatalogItem, String> {
    let metadata = read_plugin_metadata_backend(worker, entry.clone(), None)?;
    let capabilities = required_metadata_list(metadata.capabilities, "capabilities")?;
    let source_kind = infer_plugin_source_kind(&entry, Some(&source_url));
    Ok(PluginCatalogItem {
        id: required_metadata_field(metadata.id, "id")?,
        name: required_metadata_field(metadata.name, "name")?,
        version: required_metadata_field(metadata.version, "version")?,
        kind: required_metadata_field(metadata.kind, "kind")?,
        runtime: "wasm".to_string(),
        entry,
        author: required_metadata_field(metadata.author, "author")?,
        description: required_metadata_field(metadata.description, "description")?,
        icon: metadata.icon,
        updated_at: required_metadata_field(metadata.updated_at, "updatedAt")?,
        tags: plugin_capability_tags(&capabilities),
        highlights: metadata.highlights.unwrap_or_default(),
        screenshots: metadata.screenshots.unwrap_or_default(),
        capabilities,
        permissions: metadata.permissions.unwrap_or_default(),
        source_kind,
        source_url,
        config_schema: metadata.config_schema,
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
        .and_then(|value| {
            serde_json::from_value::<PluginMetadata>(value).map_err(|err| err.to_string())
        })
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

fn normalize_plugin_metadata(metadata: PluginMetadata) -> Result<PluginMetadata, String> {
    Ok(PluginMetadata {
        id: Some(required_metadata_field(metadata.id, "id")?),
        name: Some(required_metadata_field(metadata.name, "name")?),
        version: Some(required_metadata_field(metadata.version, "version")?),
        kind: Some(
            normalize_kind(required_metadata_field(metadata.kind, "kind")?)
                .ok_or_else(|| "plugin metadata kind is not supported".to_string())?,
        ),
        author: Some(required_metadata_field(metadata.author, "author")?),
        description: Some(required_metadata_field(
            metadata.description,
            "description",
        )?),
        icon: metadata.icon.and_then(non_empty_string),
        updated_at: Some(required_metadata_field(metadata.updated_at, "updatedAt")?),
        highlights: Some(normalize_text_list(metadata.highlights.unwrap_or_default())),
        screenshots: Some(normalize_screenshot_list(
            metadata.screenshots.unwrap_or_default(),
        )),
        capabilities: Some(
            normalize_capabilities(required_metadata_list(
                metadata.capabilities,
                "capabilities",
            )?)
            .ok_or_else(|| "plugin metadata capabilities cannot be empty".to_string())?,
        ),
        permissions: Some(normalize_permissions(
            metadata.permissions.unwrap_or_default(),
        )?),
        config_schema: normalize_config_schema(metadata.config_schema),
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

fn normalize_text_list(values: Vec<String>) -> Vec<String> {
    values.into_iter().filter_map(non_empty_string).fold(
        Vec::<String>::new(),
        |mut items, value| {
            if !items.contains(&value) {
                items.push(value);
            }
            items
        },
    )
}

fn normalize_screenshot_list(values: Vec<String>) -> Vec<String> {
    normalize_text_list(values).into_iter().take(5).collect()
}

fn normalize_config_schema(value: Option<Value>) -> Option<Value> {
    let value = value?;
    let fields = value
        .get("fields")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(normalize_config_field)
        .collect::<Vec<_>>();
    if fields.is_empty() {
        None
    } else {
        Some(json!({ "fields": fields }))
    }
}

fn normalize_config_field(value: &Value) -> Option<Value> {
    let key = string_field(value, &["key"])?;
    let label = string_field(value, &["label"])?;
    let field_type = normalize_config_field_type(string_field(value, &["type"])?)?;
    let options = normalize_config_options(value.get("options"));
    if matches!(field_type.as_str(), "select" | "radio" | "checkbox") && options.is_empty() {
        return None;
    }

    let mut field = serde_json::Map::new();
    field.insert("key".to_string(), Value::String(key));
    field.insert("label".to_string(), Value::String(label));
    field.insert("type".to_string(), Value::String(field_type));
    if let Some(placeholder) = string_field(value, &["placeholder"]) {
        field.insert("placeholder".to_string(), Value::String(placeholder));
    }
    if let Some(required) = value.get("required").and_then(Value::as_bool) {
        field.insert("required".to_string(), Value::Bool(required));
    }
    if let Some(default_value) = value.get("defaultValue").or_else(|| value.get("default_value")).and_then(normalize_config_default_value) {
        field.insert("defaultValue".to_string(), default_value);
    }
    if !options.is_empty() {
        field.insert("options".to_string(), Value::Array(options));
    }
    Some(Value::Object(field))
}

fn normalize_config_field_type(field_type: String) -> Option<String> {
    match field_type.trim() {
        "text" | "password" | "number" | "select" | "radio" | "checkbox" | "switch" => {
            Some(field_type.trim().to_string())
        }
        _ => None,
    }
}

fn normalize_config_options(value: Option<&Value>) -> Vec<Value> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|option| {
            let label = string_field(option, &["label"])?;
            let value = option.get("value").and_then(json_value_to_string)?;
            Some(json!({ "label": label, "value": value }))
        })
        .fold(Vec::<Value>::new(), |mut items, option| {
            let value = option.get("value").and_then(Value::as_str).unwrap_or("");
            if !items.iter().any(|item| item.get("value").and_then(Value::as_str) == Some(value)) {
                items.push(option);
            }
            items
        })
}

fn normalize_config_default_value(value: &Value) -> Option<Value> {
    match value {
        Value::String(text) if !text.trim().is_empty() => Some(Value::String(text.trim().to_string())),
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

fn normalize_runtime(runtime: Option<String>) -> Option<String> {
    match runtime.as_deref().map(str::trim) {
        Some("wasm") => Some("wasm".to_string()),
        _ => None,
    }
}

fn normalize_kind(kind: String) -> Option<String> {
    match kind.trim() {
        "music" | "lyrics" | "metadata" | "playlist" | "theme" | "integration" | "tool" => {
            Some(kind.trim().to_string())
        }
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
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_capability(capability: &str) -> Option<String> {
    match capability.trim() {
        "search" | "play" | "lyrics" | "metadata" | "cover" | "album" | "playlist-import"
        | "playlist-export" | "theme" | "scrobble" | "history-sync" | "batch-rename"
        | "lyric-convert" | "lyric-translate" => Some(capability.trim().to_string()),
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

fn normalize_permissions(permissions: Vec<String>) -> Result<Vec<String>, String> {
    Ok(permissions
        .into_iter()
        .map(|permission| {
            normalize_permission(&permission)
                .ok_or_else(|| format!("unsupported plugin permission: {permission}"))
        })
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
    value
        .split('?')
        .next()
        .unwrap_or(value)
        .to_ascii_lowercase()
        .ends_with(".wasm")
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
    response
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "Plugin cover response must be a URL string.".to_string())
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
    let request = plugin_request(plugin, json!({
        "action": "qualities",
        "track": track,
    }));
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

#[tauri::command]
pub async fn fetch_plugin_catalog(
    app: AppHandle,
    url: String,
) -> Result<ApiResponse<String>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        worker.fetch_plugin_catalog(url)
    })
    .await
    .map_err(|err| err.to_string())?;
    Ok(ApiResponse::from_result(result))
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
    ApiResponse::from_result(worker.plugin_http_request(
        method,
        url,
        headers,
        data,
        plugin_id,
        permissions,
    ))
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
    name == "key" || name.contains("apikey") || name.contains("api_key") || name.contains("token") || name.contains("secret")
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
