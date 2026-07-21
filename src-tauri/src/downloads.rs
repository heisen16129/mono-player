use crate::api_response::ApiResponse;
use crate::models::{Track, TrackLyrics};
use crate::state::AppState;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::Accessor;
use lofty::tag::{ItemKey, Tag};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, State};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct DownloadTrackRequest {
    #[serde(rename = "taskId")]
    pub(crate) task_id: Option<String>,
    #[serde(rename = "downloadDir")]
    pub(crate) download_dir: String,
    pub(crate) track: Track,
    #[serde(rename = "qualityFallback")]
    pub(crate) quality_fallback: Option<String>,
    pub(crate) plugins: Vec<crate::plugins::PluginPlaybackPlanPlugin>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ResolvedDownloadTrackRequest {
    #[serde(rename = "taskId")]
    pub(crate) task_id: Option<String>,
    pub(crate) url: String,
    #[serde(rename = "downloadDir")]
    pub(crate) download_dir: String,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) duration: Option<u64>,
    pub(crate) year: Option<u32>,
    pub(crate) genre: Option<String>,
    #[serde(rename = "trackNumber")]
    pub(crate) track_number: Option<u32>,
    pub(crate) lyrics: Option<String>,
    #[serde(rename = "lyricsFormat")]
    pub(crate) lyrics_format: Option<String>,
    pub(crate) artwork: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct DeleteDownloadedTrackFileRequest {
    #[serde(rename = "filePath")]
    pub(crate) file_path: Option<String>,
    #[serde(rename = "lyricsPath")]
    pub(crate) lyrics_path: Option<String>,
    #[serde(rename = "downloadDir")]
    pub(crate) download_dir: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) artist: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct DownloadLyricsRequest {
    #[serde(rename = "downloadDir")]
    pub(crate) download_dir: String,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) lyrics: String,
    pub(crate) format: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct DownloadCoverRequest {
    #[serde(rename = "downloadDir")]
    pub(crate) download_dir: String,
    #[serde(rename = "trackPath")]
    pub(crate) track_path: Option<String>,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    #[serde(rename = "artworkUrl")]
    pub(crate) artwork_url: Option<String>,
    #[serde(rename = "mimeType")]
    pub(crate) mime_type: Option<String>,
    pub(crate) data: Option<Vec<u8>>,
}

struct CoverArtwork {
    mime_type: MimeType,
    data: Vec<u8>,
}

#[derive(Debug, Deserialize, Serialize)]
pub(crate) struct DownloadTrackResult {
    #[serde(rename = "filePath")]
    pub(crate) file_path: String,
    #[serde(rename = "lyricsPath")]
    pub(crate) lyrics_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct DownloadLyricsResult {
    pub(crate) path: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct DownloadCoverResult {
    pub(crate) path: Option<String>,
    #[serde(rename = "embeddedInTrack")]
    pub(crate) embedded_in_track: bool,
}

#[derive(Debug, Serialize)]
pub(crate) struct EnqueueDownloadResult {
    #[serde(rename = "taskId")]
    pub(crate) task_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadQueueEvent {
    pub(crate) task_id: String,
    pub(crate) status: String,
    pub(crate) progress: u8,
    pub(crate) file_path: Option<String>,
    pub(crate) lyrics_path: Option<String>,
    pub(crate) error: Option<String>,
}

static DOWNLOAD_TASK_COUNTER: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub(crate) fn enqueue_download_online_track(
    app: tauri::AppHandle,
    request: DownloadTrackRequest,
) -> ApiResponse<EnqueueDownloadResult> {
    let task_id = request
        .task_id
        .clone()
        .unwrap_or_else(next_download_task_id);
    let app_for_task = app.clone();
    let task_id_for_task = task_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let request = resolve_download_track_request(&app_for_task, request)?;
            app_for_task
                .state::<crate::workers::download::DownloadWorkerState>()
                .enqueue_download_track(task_id_for_task.clone(), request)
        })();

        if let Err(error) = result {
            emit_download_failure(&app_for_task, &task_id_for_task, error);
        }
    });

    ApiResponse::success(EnqueueDownloadResult { task_id })
}

fn emit_download_failure(app: &tauri::AppHandle, task_id: &str, error: String) {
    let _ = app.emit(
        "download://event",
        DownloadQueueEvent {
            task_id: task_id.to_string(),
            status: "failed".to_string(),
            progress: 0,
            file_path: None,
            lyrics_path: None,
            error: Some(error),
        },
    );
}

#[tauri::command]
pub(crate) fn delete_downloaded_track_file(
    request: DeleteDownloadedTrackFileRequest,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let file_path = resolve_downloaded_track_file(&request)?;

        fs::remove_file(&file_path).map_err(|err| err.to_string())?;

        if let Some(lyrics_path) = request
            .lyrics_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let lyrics_path = PathBuf::from(lyrics_path);
            if lyrics_path.is_file() {
                let _ = fs::remove_file(lyrics_path);
            }
        } else {
            let fallback_lyrics_path = file_path.with_extension("lrc");
            if fallback_lyrics_path.is_file() {
                let _ = fs::remove_file(fallback_lyrics_path);
            }
        }

        Ok(())
    })())
}

#[tauri::command]
pub(crate) fn open_downloaded_track_in_folder(
    request: DeleteDownloadedTrackFileRequest,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let file_path = resolve_downloaded_track_file(&request)?;
        open_file_in_folder(&file_path)
    })())
}

#[tauri::command]
pub(crate) fn download_lyrics_file(
    request: DownloadLyricsRequest,
) -> ApiResponse<DownloadLyricsResult> {
    ApiResponse::from_result((|| {
        let download_dir = PathBuf::from(request.download_dir.trim());
        if download_dir.as_os_str().is_empty() {
            return Err("请先在设置中选择下载位置。".to_string());
        }
        fs::create_dir_all(&download_dir).map_err(|err| err.to_string())?;

        let lyrics = request.lyrics.trim();
        if lyrics.is_empty() {
            return Err("当前歌曲没有可下载的歌词。".to_string());
        }

        let extension = normalize_lyrics_extension(Some(&request.format))
            .ok_or_else(|| "不支持的歌词格式。".to_string())?;
        let stem = make_download_stem_from_parts(request.artist.as_deref(), request.title.trim());
        let file_path = download_dir.join(format!("{stem}.{extension}"));
        fs::write(&file_path, lyrics).map_err(|err| err.to_string())?;

        Ok(DownloadLyricsResult {
            path: file_path.to_string_lossy().to_string(),
        })
    })())
}

#[tauri::command]
pub(crate) fn download_cover_file(
    state: State<'_, AppState>,
    player_state: State<'_, crate::player::PlayerState>,
    request: DownloadCoverRequest,
) -> ApiResponse<DownloadCoverResult> {
    ApiResponse::from_result(download_cover_file_inner(state, player_state, request))
}

fn download_cover_file_inner(
    state: State<'_, AppState>,
    player_state: State<'_, crate::player::PlayerState>,
    request: DownloadCoverRequest,
) -> Result<DownloadCoverResult, String> {
    let download_dir = PathBuf::from(request.download_dir.trim());
    if download_dir.as_os_str().is_empty() {
        return Err("请先在设置中选择下载位置。".to_string());
    }
    fs::create_dir_all(&download_dir).map_err(|err| err.to_string())?;

    let (data, mime_type) = if let Some(data) = request.data.filter(|value| !value.is_empty()) {
        let mime_type = request
            .mime_type
            .as_deref()
            .and_then(mime_type_from_content_type)
            .or_else(|| mime_type_from_bytes(&data));
        (data, mime_type)
    } else {
        let artwork_url = request
            .artwork_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "当前歌曲没有可下载的封面。".to_string())?;
        if !artwork_url.starts_with("https://") && !artwork_url.starts_with("http://") {
            return Err("当前封面无法直接下载。".to_string());
        }

        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mono Player/0.1.0")
            .build()
            .map_err(|err| err.to_string())?;
        let response = client
            .get(artwork_url)
            .send()
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status().as_u16()));
        }
        let header_mime = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .and_then(mime_type_from_content_type);
        let data = response.bytes().map_err(|err| err.to_string())?.to_vec();
        let mime_type = header_mime.or_else(|| mime_type_from_bytes(&data));
        (data, mime_type)
    };

    let embedded_in_track = match write_cover_to_track_metadata(
        request.track_path.as_deref(),
        &data,
        mime_type.clone(),
    ) {
        Ok(value) => value,
        Err(error) => {
            eprintln!(
                "[download-cover] embed cover failed, fallback to image file: trackPath={:?}, title={:?}, artist={:?}, error={}",
                request.track_path, request.title, request.artist, error
            );
            false
        }
    };
    if embedded_in_track {
        if let Some(track_path) = request.track_path.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
            if let Some(artwork) = crate::covers::refresh_cached_cover_original_file_url_in(
                &player_state.cache_dir()?,
                Path::new(track_path),
            )? {
                let db = state.db.lock().map_err(|err| err.to_string())?;
                db.execute(
                    "UPDATE tracks SET artwork = ?1, updated_at = CURRENT_TIMESTAMP WHERE path = ?2",
                    params![artwork, track_path],
                )
                .map_err(|err| err.to_string())?;
            }
        }
        return Ok(DownloadCoverResult {
            path: None,
            embedded_in_track,
        });
    }

    let extension = cover_extension(mime_type.as_ref(), &data);
    let stem = make_download_stem_from_parts(request.artist.as_deref(), request.title.trim());
    let file_path = unique_file_path(&download_dir, &stem, extension);
    fs::write(&file_path, data).map_err(|err| err.to_string())?;

    Ok(DownloadCoverResult {
        path: Some(file_path.to_string_lossy().to_string()),
        embedded_in_track,
    })
}

fn resolve_downloaded_track_file(
    request: &DeleteDownloadedTrackFileRequest,
) -> Result<PathBuf, String> {
    if let Some(file_path) = request
        .file_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let path = PathBuf::from(file_path);
        if path.is_file() {
            return Ok(path.canonicalize().unwrap_or(path));
        }
    }

    let download_dir = request
        .download_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "下载文件不存在，且没有可用于查找的下载目录。".to_string())?;
    let title = request
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "下载文件不存在，且没有可用于查找的歌曲标题。".to_string())?;

    let stem = make_download_stem_from_parts(request.artist.as_deref(), title);
    let download_dir = PathBuf::from(download_dir);
    for extension in ["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav"] {
        let exact_path = download_dir.join(format!("{stem}.{extension}"));
        if exact_path.is_file() {
            return Ok(exact_path.canonicalize().unwrap_or(exact_path));
        }
    }

    let entries = fs::read_dir(&download_dir).map_err(|err| err.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() || !is_audio_path(&path) {
            continue;
        }
        let Some(file_stem) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        if file_stem == stem || file_stem.starts_with(&format!("{stem} (")) {
            return Ok(path.canonicalize().unwrap_or(path));
        }
    }

    Err("没有找到真实下载文件。".to_string())
}

fn is_audio_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("mp3" | "flac" | "m4a" | "aac" | "ogg" | "opus" | "wav")
    )
}

fn open_file_in_folder(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err("歌曲文件不存在。".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let Some(parent) = path.parent() else {
            return Err("无法打开歌曲所在文件夹。".to_string());
        };

        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }
}

fn next_download_task_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or_default();
    let index = DOWNLOAD_TASK_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("download-{millis}-{index}")
}

fn resolve_download_track_request(
    app: &tauri::AppHandle,
    request: DownloadTrackRequest,
) -> Result<ResolvedDownloadTrackRequest, String> {
    let mut track = request.track;
    let mut url = track.path.trim().to_string();
    if track.lyrics.is_none() {
        track.lyrics = legacy_track_lyrics(&track);
    }
    let quality_fallback = request
        .quality_fallback
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("standard")
        .to_string();

    if !is_http_url(&url) {
        let provider_id = track
            .source_provider_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                if url.is_empty() {
                    "歌曲缺少下载来源。".to_string()
                } else if url.starts_with("plugin://") {
                    "在线歌曲缺少插件来源信息，无法下载。".to_string()
                } else {
                    "本地歌曲无需下载。".to_string()
                }
            })?
            .to_string();
        let plugin_track = plugin_track_value(&track);
        let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
        let source = crate::plugins::resolve_plugin_playback_source_backend(
            &worker,
            provider_id,
            plugin_track,
            None,
            quality_fallback,
            true,
            request.plugins.clone(),
        )?;
        url = source.url.clone();
        track.path = source.url;
        if !source.title.trim().is_empty() {
            track.title = source.title;
        }
        if !source.artist.trim().is_empty() {
            track.artist = Some(source.artist);
        }
        if !source.album.trim().is_empty() {
            track.album = Some(source.album);
        }
        track.duration = source.duration.or(track.duration);
        track.artwork = source.artwork.or(track.artwork);
        track.source_id = Some(source.source_id)
            .filter(|value| !value.trim().is_empty())
            .or(track.source_id);
        track.source_name = Some(source.source_name)
            .filter(|value| !value.trim().is_empty())
            .or(track.source_name);
        track.source_provider_id = Some(source.source_provider_id)
            .filter(|value| !value.trim().is_empty())
            .or(track.source_provider_id);
        track.source_raw = Some(source.source_raw).or(track.source_raw);
        if track_lyrics_raw(&track.lyrics).is_none() {
            track.lyrics = source
                .lyrics
                .map(|lyrics| plugin_lyrics_to_track_lyrics(&track, lyrics));
        }
    }

    if !is_http_url(&url) {
        return Err("download url must start with http:// or https://".to_string());
    }

    if track_lyrics_raw(&track.lyrics).is_none() {
        if let Some(lyrics) = resolve_missing_track_lyrics(app, &track, &request.plugins) {
            track.lyrics = Some(lyrics);
        }
    }

    let lyrics = track_lyrics_raw(&track.lyrics);
    let lyrics_format = track
        .lyrics
        .as_ref()
        .and_then(|lyrics| lyrics.format.clone().or_else(|| lyrics.default_format.clone()));

    Ok(ResolvedDownloadTrackRequest {
        task_id: request.task_id,
        url,
        download_dir: request.download_dir,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        year: track.year,
        genre: track.genre,
        track_number: track.track_number,
        lyrics,
        lyrics_format,
        artwork: track.artwork,
    })
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn track_lyrics_raw(lyrics: &Option<TrackLyrics>) -> Option<String> {
    lyrics
        .as_ref()
        .and_then(|lyrics| lyrics.raw_lyrics.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn legacy_track_lyrics(track: &Track) -> Option<TrackLyrics> {
    if track
        .raw_lyrics
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
        && track.lyrics_source_url.is_none()
        && track.lyrics_formats.is_empty()
        && track.lyrics_provider_id.is_none()
        && track.lyrics_track_id.is_none()
    {
        return None;
    }

    Some(TrackLyrics {
        raw_lyrics: track.raw_lyrics.clone(),
        lyrics_url: track.lyrics_source_url.clone(),
        formats: track.lyrics_formats.clone(),
        default_format: track.lyrics_default_format.clone(),
        format: track
            .lyrics_format
            .clone()
            .or_else(|| track.lyrics_default_format.clone()),
        provider_id: track.lyrics_provider_id.clone(),
        provider_name: track.lyrics_source_name.clone(),
        track_id: track.lyrics_track_id.clone(),
        track_raw: track.lyrics_track_raw.clone(),
    })
}

fn plugin_track_value(track: &Track) -> serde_json::Value {
    track.source_raw.clone().unwrap_or_else(|| {
        serde_json::json!({
            "id": track.source_id.as_deref().unwrap_or_default(),
            "providerId": track.source_provider_id.as_deref().unwrap_or_default(),
            "providerName": track.source_name.as_deref().unwrap_or_default(),
            "title": track.title.clone(),
            "artist": track.artist.clone(),
            "album": track.album.clone(),
            "duration": track.duration,
            "artwork": track.artwork.clone(),
            "year": track.year,
            "genre": track.genre.clone(),
            "trackNumber": track.track_number,
        })
    })
}

fn resolve_missing_track_lyrics(
    app: &tauri::AppHandle,
    track: &Track,
    plugins: &[crate::plugins::PluginPlaybackPlanPlugin],
) -> Option<TrackLyrics> {
    let provider_id = track
        .source_provider_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();
    let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
    crate::plugins::resolve_plugin_lyrics_metadata_backend(
        &worker,
        provider_id,
        plugin_track_value(track),
        track
            .lyrics
            .as_ref()
            .and_then(|lyrics| lyrics.format.clone().or_else(|| lyrics.default_format.clone())),
        plugins.to_vec(),
    )
    .ok()
    .map(|lyrics| plugin_lyrics_to_track_lyrics(track, lyrics))
}

fn plugin_lyrics_to_track_lyrics(
    track: &Track,
    lyrics: crate::plugins::PluginLyricsMetadata,
) -> TrackLyrics {
    TrackLyrics {
        raw_lyrics: lyrics.raw_lyrics,
        lyrics_url: lyrics.lyrics_url,
        formats: lyrics.formats,
        default_format: lyrics.default_format,
        format: lyrics.format,
        provider_id: track.source_provider_id.clone(),
        provider_name: track.source_name.clone(),
        track_id: track.source_id.clone(),
        track_raw: track.source_raw.clone(),
    }
}

pub(crate) fn download_online_track_blocking_with_progress<F: FnMut(u8)>(
    request: ResolvedDownloadTrackRequest,
    mut report_progress: F,
) -> Result<DownloadTrackResult, String> {
    if !request.url.starts_with("https://") && !request.url.starts_with("http://") {
        return Err("download url must start with http:// or https://".to_string());
    }

    let download_dir = PathBuf::from(request.download_dir.trim());
    if download_dir.as_os_str().is_empty() {
        return Err("请先在设置中选择下载位置。".to_string());
    }
    fs::create_dir_all(&download_dir).map_err(|err| err.to_string())?;

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(90))
        .user_agent("Mono Player/0.1.0")
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .get(&request.url)
        .send()
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {}", status.as_u16()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let extension = infer_audio_extension(&request.url, content_type.as_deref());
    let stem = make_download_stem(&request);
    let file_path = unique_file_path(&download_dir, &stem, extension);
    write_response_to_file(response, &file_path, &mut report_progress)?;

    let artwork = download_artwork(&client, request.artwork.as_deref());
    report_progress(94);
    write_audio_metadata(&file_path, &request, artwork);
    let lyrics_stem = file_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(&stem);
    let lyrics_path = write_lyrics_file(
        &download_dir,
        lyrics_stem,
        request.lyrics.as_deref(),
        request.lyrics_format.as_deref(),
    )?;

    Ok(DownloadTrackResult {
        file_path: file_path.to_string_lossy().to_string(),
        lyrics_path: lyrics_path.map(|path| path.to_string_lossy().to_string()),
    })
}

fn write_response_to_file<F>(
    mut response: reqwest::blocking::Response,
    file_path: &Path,
    report_progress: &mut F,
) -> Result<(), String>
where
    F: FnMut(u8),
{
    let total_bytes = response.content_length();
    let mut file = fs::File::create(file_path).map_err(|err| err.to_string())?;
    let mut buffer = [0_u8; 64 * 1024];
    let mut downloaded = 0_u64;

    loop {
        let bytes_read = response.read(&mut buffer).map_err(|err| err.to_string())?;
        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .map_err(|err| err.to_string())?;
        downloaded += bytes_read as u64;

        if let Some(total_bytes) = total_bytes.filter(|value| *value > 0) {
            let progress = ((downloaded.saturating_mul(90) / total_bytes).min(90)) as u8;
            report_progress(progress);
        } else {
            report_progress(10);
        }
    }

    file.flush().map_err(|err| err.to_string())?;
    report_progress(92);
    Ok(())
}

fn write_audio_metadata(
    path: &Path,
    request: &ResolvedDownloadTrackRequest,
    artwork: Option<CoverArtwork>,
) {
    let Ok(mut tagged_file) = lofty::read_from_path(path) else {
        return;
    };

    if tagged_file.primary_tag_mut().is_none() {
        tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
    }

    if let Some(tag) = tagged_file.primary_tag_mut() {
        tag.set_title(request.title.clone());
        if let Some(artist) = request
            .artist
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            tag.set_artist(artist.clone());
        }
        if let Some(album) = request
            .album
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            tag.set_album(album.clone());
        }
        if let Some(duration) = request.duration {
            tag.insert_text(ItemKey::Length, (duration * 1000).to_string());
        }
        if let Some(year) = request.year.filter(|value| (1000..=9999).contains(value)) {
            tag.set_year(year);
        }
        if let Some(genre) = request
            .genre
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            tag.insert_text(ItemKey::Genre, genre.to_string());
        }
        if let Some(track_number) = request.track_number.filter(|value| *value > 0) {
            tag.set_track(track_number);
        }
        if let Some(lyrics) = request
            .lyrics
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            tag.insert_text(ItemKey::Lyrics, lyrics.to_string());
        }
        if let Some(artwork) = artwork {
            tag.remove_picture_type(PictureType::CoverFront);
            tag.push_picture(Picture::new_unchecked(
                PictureType::CoverFront,
                Some(artwork.mime_type),
                None,
                artwork.data,
            ));
        }
    }

    let _ = tagged_file.save_to_path(path, WriteOptions::default());
}

fn write_cover_to_track_metadata(
    track_path: Option<&str>,
    data: &[u8],
    mime_type: Option<MimeType>,
) -> Result<bool, String> {
    let Some(track_path) = track_path.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(false);
    };
    if track_path.starts_with("http://")
        || track_path.starts_with("https://")
        || track_path.starts_with("plugin://")
    {
        return Ok(false);
    }

    let path = PathBuf::from(track_path);
    if !path.is_file() {
        return Ok(false);
    }

    let mut tagged_file = lofty::read_from_path(&path).map_err(|err| err.to_string())?;
    if tagged_file.primary_tag_mut().is_none() {
        tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
    }

    let mime_type = mime_type
        .or_else(|| mime_type_from_bytes(data))
        .unwrap_or(MimeType::Jpeg);
    if let Some(tag) = tagged_file.primary_tag_mut() {
        tag.remove_picture_type(PictureType::CoverFront);
        tag.push_picture(Picture::new_unchecked(
            PictureType::CoverFront,
            Some(mime_type),
            None,
            data.to_vec(),
        ));
    }

    tagged_file
        .save_to_path(&path, WriteOptions::default())
        .map_err(|err| err.to_string())?;
    Ok(true)
}

fn download_artwork(
    client: &reqwest::blocking::Client,
    artwork_url: Option<&str>,
) -> Option<CoverArtwork> {
    let artwork_url = artwork_url?.trim();
    if artwork_url.is_empty()
        || (!artwork_url.starts_with("https://") && !artwork_url.starts_with("http://"))
    {
        return None;
    }

    let response = client.get(artwork_url).send().ok()?;
    if !response.status().is_success() {
        return None;
    }

    let header_mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(mime_type_from_content_type);
    let data = response.bytes().ok()?.to_vec();
    let mime_type = header_mime.or_else(|| mime_type_from_bytes(&data))?;

    Some(CoverArtwork { mime_type, data })
}

fn mime_type_from_content_type(content_type: &str) -> Option<MimeType> {
    let mime_type = content_type.split(';').next()?.trim();
    match MimeType::from_str(mime_type) {
        MimeType::Unknown(_) => None,
        known => Some(known),
    }
}

fn mime_type_from_bytes(data: &[u8]) -> Option<MimeType> {
    match data {
        [0xFF, 0xD8, 0xFF, ..] => Some(MimeType::Jpeg),
        [0x89, b'P', b'N', b'G', ..] => Some(MimeType::Png),
        [b'G', b'I', b'F', ..] => Some(MimeType::Gif),
        [b'B', b'M', ..] => Some(MimeType::Bmp),
        _ => None,
    }
}

fn cover_extension(mime_type: Option<&MimeType>, data: &[u8]) -> &'static str {
    let inferred_mime_type = mime_type.cloned().or_else(|| mime_type_from_bytes(data));
    match inferred_mime_type.as_ref() {
        Some(MimeType::Jpeg) => "jpg",
        Some(MimeType::Png) => "png",
        Some(MimeType::Gif) => "gif",
        Some(MimeType::Bmp) => "bmp",
        _ => "jpg",
    }
}

fn write_lyrics_file(
    download_dir: &Path,
    stem: &str,
    lyrics: Option<&str>,
    format: Option<&str>,
) -> Result<Option<PathBuf>, String> {
    let Some(lyrics) = lyrics.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };

    let extension = normalize_lyrics_extension(format).unwrap_or("lrc");
    let lyrics_path = unique_file_path(download_dir, stem, extension);
    fs::write(&lyrics_path, lyrics).map_err(|err| err.to_string())?;
    Ok(Some(lyrics_path))
}

fn normalize_lyrics_extension(format: Option<&str>) -> Option<&'static str> {
    match format.unwrap_or("lrc").trim().to_ascii_lowercase().as_str() {
        "" | "lrc" => Some("lrc"),
        "txt" => Some("txt"),
        "trans" => Some("trans"),
        "yrc" => Some("yrc"),
        "qrc" => Some("qrc"),
        "krc" => Some("krc"),
        "a2" => Some("a2"),
        _ => None,
    }
}

fn make_download_stem(request: &ResolvedDownloadTrackRequest) -> String {
    make_download_stem_from_parts(request.artist.as_deref(), request.title.trim())
}

fn make_download_stem_from_parts(artist: Option<&str>, title: &str) -> String {
    let mut parts = Vec::new();
    parts.push(title.trim());
    if let Some(artist) = artist.filter(|value| !value.trim().is_empty()) {
        parts.push(artist.trim());
    }
    sanitize_file_name(&parts.join(" - "))
}

fn sanitize_file_name(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();

    if cleaned.is_empty() {
        "Unknown Track".to_string()
    } else {
        cleaned
    }
}

fn unique_file_path(dir: &Path, stem: &str, extension: &str) -> PathBuf {
    let mut path = dir.join(format!("{stem}.{extension}"));
    let mut index = 1;
    while path.exists() {
        path = dir.join(format!("{stem} ({index}).{extension}"));
        index += 1;
    }
    path
}

fn infer_audio_extension(url: &str, content_type: Option<&str>) -> &'static str {
    if let Some(extension) = extension_from_content_type(content_type) {
        return extension;
    }

    let path = url.split('?').next().unwrap_or(url);
    match Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("flac") => "flac",
        Some("m4a") | Some("mp4") => "m4a",
        Some("aac") => "aac",
        Some("ogg") => "ogg",
        Some("opus") => "opus",
        Some("wav") => "wav",
        _ => "mp3",
    }
}

fn extension_from_content_type(content_type: Option<&str>) -> Option<&'static str> {
    let content_type = content_type?.to_ascii_lowercase();
    if content_type.contains("flac") {
        Some("flac")
    } else if content_type.contains("mp4") || content_type.contains("m4a") {
        Some("m4a")
    } else if content_type.contains("aac") {
        Some("aac")
    } else if content_type.contains("ogg") {
        Some("ogg")
    } else if content_type.contains("opus") {
        Some("opus")
    } else if content_type.contains("wav") {
        Some("wav")
    } else if content_type.contains("mpeg") || content_type.contains("mp3") {
        Some("mp3")
    } else {
        None
    }
}
