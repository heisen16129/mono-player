use crate::{
    api_response::ApiResponse,
    models::CoverImage,
    player::{mono_cache_dir, PlayerState},
};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use lofty::file::TaggedFileExt;
use serde::Deserialize;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashSet;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;
#[cfg(not(target_os = "windows"))]
use tauri::Url;
use tauri::State;

static FAILED_EMBEDDED_COVER_KEYS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CropCoverImageRequest {
    image_path: String,
    x: u32,
    y: u32,
    size: u32,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CropCoverImageResult {
    path: String,
}

#[tauri::command]
pub(crate) fn read_cover(path: String) -> ApiResponse<Option<CoverImage>> {
    ApiResponse::from_result(read_cover_backend(path))
}

pub(crate) fn read_cover_backend(path: String) -> Result<Option<CoverImage>, String> {
    let audio_path = PathBuf::from(path);
    read_cover_uncached(&audio_path)
}

#[tauri::command]
pub(crate) fn crop_cover_image(
    state: State<'_, PlayerState>,
    request: CropCoverImageRequest,
) -> ApiResponse<CropCoverImageResult> {
    ApiResponse::from_result((|| {
        let image_path = PathBuf::from(request.image_path.trim());
        let image = image::open(&image_path).map_err(|err| err.to_string())?;
        let image_width = image.width();
        let image_height = image.height();
        if image_width == 0 || image_height == 0 {
            return Err("Invalid cover image.".to_string());
        }

        let max_size = image_width.min(image_height);
        let crop_size = request.size.clamp(1, max_size);
        let x = request.x.min(image_width.saturating_sub(crop_size));
        let y = request.y.min(image_height.saturating_sub(crop_size));
        let cropped = image.crop_imm(x, y, crop_size, crop_size).to_rgb8();

        let output_dir = mono_cache_dir(&state.cache_dir()?).join("cover-edits");
        fs::create_dir_all(&output_dir).map_err(|err| err.to_string())?;
        let output_path = output_dir.join(format!("{}.jpg", uuid::Uuid::new_v4()));
        let file = fs::File::create(&output_path).map_err(|err| err.to_string())?;
        let mut encoder = JpegEncoder::new_with_quality(file, 92);
        encoder
            .encode_image(&cropped)
            .map_err(|err| err.to_string())?;

        Ok(CropCoverImageResult {
            path: output_path.to_string_lossy().to_string(),
        })
    })())
}

#[tauri::command]
pub(crate) async fn read_cover_thumbnail(
    state: State<'_, PlayerState>,
    path: String,
) -> Result<ApiResponse<Option<CoverImage>>, String> {
    Ok(ApiResponse::from_result(
        (|| async {
            let cache_root = state.cache_dir()?;
            tauri::async_runtime::spawn_blocking(move || {
                read_cover_thumbnail_blocking(&cache_root, &path)
            })
            .await
            .map_err(|err| err.to_string())?
        })()
        .await,
    ))
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
) -> ApiResponse<()> {
    ApiResponse::from_empty_result((|| {
        let audio_path = PathBuf::from(path);
        let cache_path = cached_cover_thumbnail_path(&state.cache_dir()?, &audio_path)?;
        if cache_path.is_file() {
            fs::remove_file(cache_path).map_err(|err| err.to_string())?;
        }

        Ok(())
    })())
}

pub(crate) fn cached_cover_original_file_url_in(
    cache_root: &Path,
    audio_path: &Path,
) -> Result<Option<String>, String> {
    let Some(cover) = read_cover_uncached(audio_path)? else {
        return Ok(None);
    };

    let cache_dir = mono_cache_dir(cache_root).join("cover-originals");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    let cache_path = cache_dir.join(format!(
        "{}.{}",
        cover_cache_key(audio_path),
        cover_extension(&cover.mime_type)
    ));
    if !cache_path.is_file() {
        fs::write(&cache_path, &cover.data).map_err(|err| err.to_string())?;
    }

    Ok(cover_file_url(&cache_path))
}

pub(crate) fn refresh_cached_cover_original_file_url_in(
    cache_root: &Path,
    audio_path: &Path,
) -> Result<Option<String>, String> {
    let Some(cover) = read_cover_uncached(audio_path)? else {
        return Ok(None);
    };

    let cache_dir = mono_cache_dir(cache_root).join("cover-originals");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    let cache_path = cache_dir.join(format!(
        "{}.{}",
        cover_cache_key(audio_path),
        cover_extension(&cover.mime_type)
    ));
    fs::write(&cache_path, &cover.data).map_err(|err| err.to_string())?;

    Ok(cover_file_url(&cache_path))
}

pub(crate) fn write_sidecar_cover_file_url(
    audio_path: &Path,
    cover_path: &Path,
) -> Result<Option<String>, String> {
    if !audio_path.is_file() || !cover_path.is_file() {
        return Ok(None);
    }
    let Some(parent) = audio_path.parent() else {
        return Ok(None);
    };
    let Some(stem) = audio_path.file_stem().and_then(|value| value.to_str()) else {
        return Ok(None);
    };

    let data = fs::read(cover_path).map_err(|err| err.to_string())?;
    let mime_type = cover_mime_type(cover_path).unwrap_or("image/jpeg");
    let sidecar_path = parent.join(format!("{stem}.{}", cover_extension(mime_type)));
    fs::write(&sidecar_path, data).map_err(|err| err.to_string())?;
    Ok(cover_file_url(&sidecar_path))
}

fn cached_cover_thumbnail_path(cache_root: &Path, audio_path: &Path) -> Result<PathBuf, String> {
    let cache_dir = mono_cache_dir(cache_root).join("cover-thumbnails");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    Ok(cache_dir.join(format!("{}.jpg", cover_cache_key(audio_path))))
}

#[cfg(target_os = "windows")]
fn cover_file_url(path: &Path) -> Option<String> {
    Some(format!(
        "file:///{}",
        path.to_string_lossy().replace('\\', "/")
    ))
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
    let cache_key = cover_cache_key(audio_path);
    if embedded_cover_failed_before(&cache_key) {
        return Ok(None);
    }

    match crate::metadata::read_tagged_file(audio_path, "cover") {
        Ok(tagged_file) => {
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
        Err(_) => remember_failed_embedded_cover(cache_key),
    }

    Ok(None)
}

fn embedded_cover_failed_before(cache_key: &str) -> bool {
    FAILED_EMBEDDED_COVER_KEYS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map(|keys| keys.contains(cache_key))
        .unwrap_or(false)
}

fn remember_failed_embedded_cover(cache_key: String) {
    if let Ok(mut keys) = FAILED_EMBEDDED_COVER_KEYS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
    {
        keys.insert(cache_key);
    }
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

fn cover_extension(mime_type: &str) -> &'static str {
    match mime_type.to_ascii_lowercase().as_str() {
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "jpg",
    }
}
