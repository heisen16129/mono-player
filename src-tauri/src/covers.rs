use crate::{
    models::CoverImage,
    player::{mono_cache_dir, PlayerState},
};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use lofty::file::TaggedFileExt;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
#[cfg(not(target_os = "windows"))]
use tauri::Url;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub(crate) fn read_cover(path: String) -> Result<Option<CoverImage>, String> {
    let audio_path = PathBuf::from(path);
    read_cover_uncached(&audio_path)
}

#[tauri::command]
pub(crate) async fn read_cover_thumbnail(
    state: State<'_, PlayerState>,
    path: String,
) -> Result<Option<CoverImage>, String> {
    let cache_root = state.cache_dir()?;
    tauri::async_runtime::spawn_blocking(move || read_cover_thumbnail_blocking(&cache_root, &path))
        .await
        .map_err(|err| err.to_string())?
}

fn read_cover_thumbnail_blocking(
    cache_root: &Path,
    path: &str,
) -> Result<Option<CoverImage>, String> {
    let audio_path = PathBuf::from(path);
    let cache_path = cached_cover_thumbnail_path(cache_root, &audio_path)?;

    if cache_path.is_file() {
        let data = fs::read(cache_path).map_err(|err| err.to_string())?;
        return Ok(Some(CoverImage {
            mime_type: "image/jpeg".to_string(),
            data,
        }));
    }

    let Some(cover) = read_thumbnail_cover_uncached(&audio_path)? else {
        return Ok(None);
    };
    let thumbnail = create_cover_thumbnail(&cover.data)?;
    fs::write(&cache_path, &thumbnail).map_err(|err| err.to_string())?;

    Ok(Some(CoverImage {
        mime_type: "image/jpeg".to_string(),
        data: thumbnail,
    }))
}

#[tauri::command]
pub(crate) fn clear_cover_thumbnail_cache(
    state: State<'_, PlayerState>,
    path: String,
) -> Result<(), String> {
    let audio_path = PathBuf::from(path);
    let cache_path = cached_cover_thumbnail_path(&state.cache_dir()?, &audio_path)?;
    if cache_path.is_file() {
        fs::remove_file(cache_path).map_err(|err| err.to_string())?;
    }

    Ok(())
}

pub(crate) fn cached_cover_thumbnail_file_url(
    app: &AppHandle,
    path: &str,
) -> Result<Option<String>, String> {
    let audio_path = PathBuf::from(path);
    let state = app.state::<PlayerState>();
    let cache_path = cached_cover_thumbnail_path(&state.cache_dir()?, &audio_path)?;
    if !cache_path.is_file() {
        let Some(cover) = read_thumbnail_cover_uncached(&audio_path)? else {
            return Ok(None);
        };
        let thumbnail = create_cover_thumbnail(&cover.data)?;
        fs::write(&cache_path, &thumbnail).map_err(|err| err.to_string())?;
    }

    Ok(cover_file_url(&cache_path))
}

fn cached_cover_thumbnail_path(cache_root: &Path, audio_path: &Path) -> Result<PathBuf, String> {
    let cache_dir = mono_cache_dir(cache_root).join("cover-thumbnails");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    Ok(cache_dir.join(format!("{}.jpg", cover_cache_key(audio_path))))
}

#[cfg(target_os = "windows")]
fn cover_file_url(path: &Path) -> Option<String> {
    Some(format!("file://{}", path.to_string_lossy()))
}

#[cfg(not(target_os = "windows"))]
fn cover_file_url(path: &Path) -> Option<String> {
    Url::from_file_path(path).ok().map(|url| url.to_string())
}

fn read_cover_uncached(audio_path: &Path) -> Result<Option<CoverImage>, String> {
    if let Some(cover) = read_embedded_cover_image(audio_path)? {
        return Ok(Some(cover));
    }

    read_local_cover_image(audio_path)
}

fn read_thumbnail_cover_uncached(audio_path: &Path) -> Result<Option<CoverImage>, String> {
    if let Some(cover) = read_local_cover_image(audio_path)? {
        return Ok(Some(cover));
    }

    read_embedded_cover_image(audio_path)
}

fn read_embedded_cover_image(audio_path: &Path) -> Result<Option<CoverImage>, String> {
    if let Ok(tagged_file) = lofty::read_from_path(audio_path) {
        let tag = tagged_file
            .primary_tag()
            .or_else(|| tagged_file.first_tag());
        if let Some(picture) = tag.and_then(|tag| tag.pictures().first()) {
            let mime_type = picture
                .mime_type()
                .map(|mime_type| mime_type.as_str().to_string())
                .unwrap_or_else(|| "image/jpeg".to_string());

            return Ok(Some(CoverImage {
                mime_type,
                data: picture.data().to_vec(),
            }));
        }
    }

    Ok(None)
}

fn create_cover_thumbnail(data: &[u8]) -> Result<Vec<u8>, String> {
    let image = image::load_from_memory(data).map_err(|err| err.to_string())?;
    let thumbnail = image.resize_to_fill(96, 96, FilterType::Triangle).to_rgb8();
    let mut bytes = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    let mut encoder = JpegEncoder::new_with_quality(&mut cursor, 82);
    encoder
        .encode_image(&thumbnail)
        .map_err(|err| err.to_string())?;
    Ok(bytes)
}

fn cover_cache_key(audio_path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    audio_path.to_string_lossy().hash(&mut hasher);
    if let Ok(metadata) = audio_path.metadata() {
        metadata.len().hash(&mut hasher);
        metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

fn read_local_cover_image(audio_path: &Path) -> Result<Option<CoverImage>, String> {
    let Some(parent) = audio_path.parent() else {
        return Ok(None);
    };

    let mut candidates = Vec::new();
    for name in ["cover", "front", "folder", "album"] {
        for extension in ["jpg", "jpeg", "png", "webp"] {
            candidates.push(parent.join(format!("{name}.{extension}")));
        }
    }

    if let Some(stem) = audio_path.file_stem().and_then(|value| value.to_str()) {
        for extension in ["jpg", "jpeg", "png", "webp"] {
            candidates.push(parent.join(format!("{stem}.{extension}")));
        }
    }

    let Some(cover_path) = candidates.into_iter().find(|path| path.is_file()) else {
        return Ok(None);
    };

    let mime_type = cover_mime_type(&cover_path)
        .unwrap_or("image/jpeg")
        .to_string();
    let data = fs::read(&cover_path).map_err(|err| err.to_string())?;

    Ok(Some(CoverImage { mime_type, data }))
}

fn cover_mime_type(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg") | Some("jpeg") => Some("image/jpeg"),
        Some("png") => Some("image/png"),
        Some("webp") => Some("image/webp"),
        _ => None,
    }
}
