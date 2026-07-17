use serde_json::json;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const PLUGIN_HTTP_TIMEOUT: Duration = Duration::from_secs(8);

fn log_plugin_playback(method: &str, args: serde_json::Value) {
    eprintln!("[plugin-playback] {method} args={args}");
}

fn json_string_field<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a str> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
}

#[derive(serde::Deserialize)]
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
pub struct PluginPlaybackSource {
    url: String,
    path: String,
    title: String,
    artist: String,
    album: String,
    duration: Option<u64>,
    artwork: Option<String>,
    lyrics: Option<PluginLyricsMetadata>,
    quality: String,
    source_id: String,
    source_name: String,
    source_provider_id: String,
    source_raw: serde_json::Value,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLyricsMetadata {
    raw_lyrics: Option<String>,
    lyrics_url: Option<String>,
    formats: Vec<String>,
    default_format: Option<String>,
    format: Option<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct PluginHttpResponse {
    pub(crate) status: u16,
    pub(crate) headers: HashMap<String, String>,
    pub(crate) body: String,
}

#[tauri::command]
pub fn plugin_invoke(
    worker: State<'_, crate::workers::plugin::PluginWorkerState>,
    entry: String,
    request: serde_json::Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    worker.invoke_plugin(entry, request, plugin_id, permissions)
}

#[tauri::command]
pub fn resolve_plugin_playback_plan(
    provider_id: String,
    preferred_quality: String,
    _quality_fallback: String,
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
) -> Result<PluginPlaybackQualities, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_playback_qualities_backend(&worker, provider_id, track, plugins)
    })
    .await
    .map_err(|err| err.to_string())?
}

fn resolve_plugin_playback_qualities_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackQualities, String> {
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

    let response = worker.invoke_plugin(
        entry,
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;

    normalize_plugin_playback_qualities(response)
}

#[tauri::command]
pub async fn resolve_plugin_playback_source(
    app: AppHandle,
    provider_id: String,
    track: serde_json::Value,
    preferred_quality: Option<String>,
    _quality_fallback: String,
    include_metadata: bool,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackSource, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_playback_source_backend(
            &worker,
            provider_id,
            track,
            preferred_quality,
            _quality_fallback,
            include_metadata,
            plugins,
        )
    })
    .await
    .map_err(|err| err.to_string())?
}

fn resolve_plugin_playback_source_backend(
    worker: &crate::workers::plugin::PluginWorkerState,
    provider_id: String,
    track: serde_json::Value,
    preferred_quality: Option<String>,
    _quality_fallback: String,
    include_metadata: bool,
    plugins: Vec<PluginPlaybackPlanPlugin>,
) -> Result<PluginPlaybackSource, String> {
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

        match worker.invoke_plugin(
            entry.clone(),
            request,
            Some(plugin.id.clone()),
            plugin.permissions.clone(),
        ) {
            Ok(response) => {
                log_plugin_playback(
                    "resolve_plugin_playback_source raw response",
                    json!({
                        "providerId": plugin.id,
                        "quality": quality,
                        "response": response.clone(),
                    }),
                );
                match normalize_plugin_playback_source(response, &quality, &plugin_track, &plugin) {
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
) -> Result<PluginLyricsMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        resolve_plugin_lyrics_metadata_backend(&worker, provider_id, track, format, plugins)
    })
    .await
    .map_err(|err| err.to_string())?
}

fn resolve_plugin_lyrics_metadata_backend(
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

    normalize_plugin_lyrics_metadata(response)
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
    normalize_plugin_lyrics_metadata(response)
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

fn resolve_playback_quality_attempts(
    worker: &crate::workers::plugin::PluginWorkerState,
    entry: &str,
    plugin: &PluginPlaybackPlanPlugin,
    track: &serde_json::Value,
    preferred_quality: Option<&str>,
) -> Result<Vec<String>, String> {
    let request = json!({
        "action": "qualities",
        "track": track,
    });
    let response = worker.invoke_plugin(
        entry.to_string(),
        request,
        Some(plugin.id.clone()),
        plugin.permissions.clone(),
    )?;
    let qualities = normalize_plugin_playback_qualities(response)?;

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
) -> Result<String, String> {
    worker.fetch_plugin_catalog(url)
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
) -> Result<Vec<u8>, String> {
    worker.read_plugin_wasm_bytes(entry)
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
) -> Result<PluginHttpResponse, String> {
    worker.plugin_http_request(method, url, headers, data, plugin_id, permissions)
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
