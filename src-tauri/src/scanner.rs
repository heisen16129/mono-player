use crate::database::{
    delete_missing_tracks_for_dir, delete_tracks_without_files, read_latest_added_tracks,
    read_tracks, upsert_track,
};
use crate::api_response::ApiResponse;
use crate::models::Track;
use crate::state::AppState;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::prelude::Accessor;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
pub(crate) struct ScanMusicDirResult {
    pub(crate) tracks: Vec<Track>,
    #[serde(rename = "addedTracks")]
    pub(crate) added_tracks: Vec<Track>,
    #[serde(rename = "addedTrackIds")]
    pub(crate) added_track_ids: Vec<i64>,
}

#[tauri::command]
pub(crate) async fn scan_music_dir(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
    scan_worker: State<'_, crate::workers::scanner::ScanWorkerState>,
) -> Result<ApiResponse<ScanMusicDirResult>, String> {
    Ok(ApiResponse::from_result(scan_music_dir_inner(path, app, state, scan_worker).await))
}

async fn scan_music_dir_inner(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
    scan_worker: State<'_, crate::workers::scanner::ScanWorkerState>,
) -> Result<ScanMusicDirResult, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Music directory does not exist or is not a folder.".to_string());
    }
    let scan_id = uuid::Uuid::new_v4().to_string();
    let scanned_tracks =
        scan_music_dir_in_worker(path, app.clone(), scan_worker.inner().clone()).await?;
    let _ = app.emit("scan://done", scanned_tracks.len());
    let scanned_paths = scanned_tracks
        .iter()
        .map(|track| track.path.clone())
        .collect::<HashSet<_>>();

    let db = state.db.lock().map_err(|err| err.to_string())?;
    for track in scanned_tracks {
        upsert_track(&db, &track, Some(&scan_id))?;
    }
    delete_missing_tracks_for_dir(&db, &root, &scanned_paths)?;
    delete_tracks_without_files(&db)?;
    let tracks = read_tracks(&db)?;
    let added_tracks = read_latest_added_tracks(&db)?;
    let added_track_ids = added_tracks
        .iter()
        .map(|track| track.id)
        .collect::<Vec<_>>();

    Ok(ScanMusicDirResult {
        tracks,
        added_tracks,
        added_track_ids,
    })
}

#[tauri::command]
pub(crate) fn cancel_scan_music_dir(
    scan_worker: State<'_, crate::workers::scanner::ScanWorkerState>,
) -> ApiResponse<bool> {
    ApiResponse::from_result(scan_worker.cancel())
}

async fn scan_music_dir_in_worker(
    path: String,
    app: AppHandle,
    scan_worker: crate::workers::scanner::ScanWorkerState,
) -> Result<Vec<Track>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tracks = Vec::new();
        crate::workers::run_scan_worker(&scan_worker, path, |track| {
            let _ = app.emit("scan://track", &track);
            tracks.push(track);
            Ok(())
        })?;
        Ok(tracks)
    })
    .await
    .map_err(|err| err.to_string())?
}

pub(crate) fn scan_music_dir_entries<F>(root: &Path, mut on_track: F) -> Result<usize, String>
where
    F: FnMut(Track) -> Result<(), String>,
{
    let mut count = 0;
    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if path.is_file() && is_audio_file(path) {
            let track = read_track_metadata(path).unwrap_or_else(|_| fallback_track_metadata(path));
            on_track(track)?;
            count += 1;
        }
    }
    Ok(count)
}

fn read_track_metadata(path: &Path) -> Result<Track, String> {
    let tagged_file = lofty::read_from_path(path).map_err(|err| err.to_string())?;
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let fallback_title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown Title")
        .to_string();

    let title = tag
        .and_then(|tag| tag.title())
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback_title);

    let artist = tag
        .and_then(|tag| tag.artist())
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty());

    let album = tag
        .and_then(|tag| tag.album())
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty());

    Ok(Track {
        id: 0,
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration: Some(tagged_file.properties().duration().as_secs()),
        added_at: None,
        scan_id: None,
        year: None,
        genre: None,
        track_number: None,
        artwork: None,
        associated_artwork: None,
        lyrics: None,
        associated_lyrics: None,
        raw_lyrics: None,
        lyrics_source_name: None,
        lyrics_source_url: None,
        lyrics_formats: Vec::new(),
        lyrics_default_format: None,
        lyrics_format: None,
        lyrics_provider_id: None,
        lyrics_track_id: None,
        lyrics_track_raw: None,
        source_id: None,
        source_name: None,
        source_provider_id: None,
        source_raw: None,
    })
}

fn fallback_track_metadata(path: &Path) -> Track {
    let fallback_title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown Title")
        .trim()
        .to_string();
    let (title, artist) = fallback_title
        .split_once(" - ")
        .map(|(title, artist)| (title.trim().to_string(), Some(artist.trim().to_string())))
        .unwrap_or((fallback_title, None));

    Track {
        id: 0,
        path: path.to_string_lossy().to_string(),
        title: if title.is_empty() {
            "Unknown Title".to_string()
        } else {
            title
        },
        artist: artist.filter(|value| !value.is_empty()),
        album: None,
        duration: None,
        added_at: None,
        scan_id: None,
        year: None,
        genre: None,
        track_number: None,
        artwork: None,
        associated_artwork: None,
        lyrics: None,
        associated_lyrics: None,
        raw_lyrics: None,
        lyrics_source_name: None,
        lyrics_source_url: None,
        lyrics_formats: Vec::new(),
        lyrics_default_format: None,
        lyrics_format: None,
        lyrics_provider_id: None,
        lyrics_track_id: None,
        lyrics_track_raw: None,
        source_id: None,
        source_name: None,
        source_provider_id: None,
        source_raw: None,
    }
}

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac" | "opus" | "aiff"
            )
        })
        .unwrap_or(false)
}
