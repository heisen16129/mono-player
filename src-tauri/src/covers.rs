use crate::{
    api_response::ApiResponse,
    models::CoverImage,
    player::{mono_cache_dir, PlayerState},
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
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
use tauri::{State, Url};

static FAILED_EMBEDDED_COVER_KEYS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
const COVER_CACHE_VERSION: u8 = 2;
const MAX_EDITED_COVER_SIZE: u32 = 1600;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CropCoverImageRequest {
    image_data_url: Option<String>,
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

pub(crate) struct CachedCoverFiles {
    pub(crate) original_path: PathBuf,
    pub(crate) original_url: String,
    pub(crate) thumbnail_url: String,
}

#[tauri::command]
pub(crate) fn read_remote_cover(url: String) -> ApiResponse<CoverImage> {
    use std::io::Read;
    ApiResponse::from_result((|| {
        let url = Url::parse(url.trim()).map_err(|err| err.to_string())?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err("封面地址必须使用 HTTP 或 HTTPS".to_string());
        }
        let response = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent("Mono Player/0.1.0")
            .build().map_err(|err| err.to_string())?
            .get(url).send().map_err(|err| err.to_string())?
            .error_for_status().map_err(|err| err.to_string())?;
        let mut data = Vec::new();
        response.take(32 * 1024 * 1024 + 1).read_to_end(&mut data).map_err(|err| err.to_string())?;
        if data.len() > 32 * 1024 * 1024 { return Err("封面图片过大".to_string()); }
        let format = image::guess_format(&data).map_err(|_| "无法识别封面图片格式".to_string())?;
        Ok(CoverImage { mime_type: format.to_mime_type().to_string(), data })
    })())
}

#[tauri::command]
pub(crate) fn read_artwork_file(artwork: String) -> ApiResponse<Option<CoverImage>> {
    ApiResponse::from_result((|| {
        let artwork = artwork.trim();
        if artwork.is_empty() {
            return Ok(None);
        }
        let artwork_path = if artwork.starts_with("file://") {
            Url::parse(artwork)
                .map_err(|err| err.to_string())?
                .to_file_path()
                .map_err(|_| "Invalid artwork file URL.".to_string())?
        } else {
            PathBuf::from(artwork)
        };
        if !artwork_path.is_file() {
            return Ok(None);
        }
        let mime_type = cover_mime_type(&artwork_path)
            .ok_or_else(|| "Unsupported artwork image format.".to_string())?
            .to_string();
        let metadata = fs::metadata(&artwork_path).map_err(|err| err.to_string())?;
        if metadata.len() > 32 * 1024 * 1024 {
            return Err("Artwork image is too large.".to_string());
        }
        let data = fs::read(artwork_path).map_err(|err| err.to_string())?;
        Ok(Some(CoverImage { mime_type, data }))
    })())
}

pub(crate) fn read_cover_backend(path: String) -> Result<Option<CoverImage>, String> {
    let audio_path = PathBuf::from(path);
    read_cover_uncached(&audio_path)
}

#[tauri::command]
pub(crate) fn read_track_cover_original(
    state: State<'_, PlayerState>,
    path: String,
) -> ApiResponse<Option<String>> {
    ApiResponse::from_result((|| {
        let audio_path = PathBuf::from(path.trim());
        if !audio_path.is_file() {
            return Ok(None);
        }
        let cache_root = state.cache_dir()?;
        if cached_cover_files_in(&cache_root, &audio_path)?.is_none() {
            return Ok(None);
        }
        Ok(find_cached_cover_original_path(&cache_root, &audio_path)
            .map(|cover_path| cover_path.to_string_lossy().to_string()))
    })())
}

#[tauri::command]
pub(crate) fn crop_cover_image(
    state: State<'_, PlayerState>,
    request: CropCoverImageRequest,
) -> ApiResponse<CropCoverImageResult> {
    ApiResponse::from_result(
        state
            .cache_dir()
            .and_then(|root| crop_cover_image_in(&root, request)),
    )
}

fn crop_cover_image_in(
    root: &Path,
    request: CropCoverImageRequest,
) -> Result<CropCoverImageResult, String> {
    let cache_root = mono_cache_dir(root);
    let output_dir = cache_root.join("cover-originals");
    fs::create_dir_all(&output_dir).map_err(|err| err.to_string())?;
    let filename = format!("custom-{}.jpg", uuid::Uuid::new_v4());
    let output_path = output_dir.join(&filename);
    if let Some(image_data_url) = request.image_data_url.as_deref() {
        let encoded = image_data_url
            .strip_prefix("data:image/jpeg;base64,")
            .ok_or_else(|| "Invalid edited cover image.".to_string())?;
        if encoded.len() > 16 * 1024 * 1024 {
            return Err("Edited cover image is too large.".to_string());
        }
        let data = STANDARD.decode(encoded).map_err(|err| err.to_string())?;
        fs::write(&output_path, data).map_err(|err| err.to_string())?;
    } else {
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
        let output = if crop_size > MAX_EDITED_COVER_SIZE {
            image::imageops::resize(
                &cropped,
                MAX_EDITED_COVER_SIZE,
                MAX_EDITED_COVER_SIZE,
                FilterType::Triangle,
            )
        } else {
            cropped
        };
        let file = fs::File::create(&output_path).map_err(|err| err.to_string())?;
        let mut encoder = JpegEncoder::new_with_quality(file, 92);
        encoder
            .encode_image(&output)
            .map_err(|err| err.to_string())?;
    }

    let thumbnail_dir = cache_root.join("cover-thumbnails");
    fs::create_dir_all(&thumbnail_dir).map_err(|err| err.to_string())?;
    let thumbnail_path = thumbnail_dir.join(filename);
    let data = fs::read(&output_path).map_err(|err| err.to_string())?;
    fs::write(&thumbnail_path, create_cover_thumbnail(&data)?).map_err(|err| err.to_string())?;
    Ok(CropCoverImageResult {
        path: output_path.to_string_lossy().to_string(),
    })
}

pub(crate) fn cached_cover_files_in(
    cache_root: &Path,
    audio_path: &Path,
) -> Result<Option<CachedCoverFiles>, String> {
    let thumbnail_path = cover_thumbnail_cache_path(cache_root, audio_path)?;
    let original_path = find_cached_cover_original_path(cache_root, audio_path);
    if thumbnail_path.is_file() {
        if let Some(original_path) = original_path {
            return cached_cover_files(&original_path, &thumbnail_path);
        }
    }
    let Some(cover) = read_cover_uncached(audio_path)? else {
        return Ok(None);
    };
    write_cached_cover_files(cache_root, audio_path, &cover, true)
}

pub(crate) fn refresh_cached_cover_files_in(
    cache_root: &Path,
    audio_path: &Path,
) -> Result<Option<CachedCoverFiles>, String> {
    let Some(cover) = read_cover_uncached(audio_path)? else {
        return Ok(None);
    };
    write_cached_cover_files(cache_root, audio_path, &cover, true)
}

pub(crate) fn refresh_cached_cover_files_from_data_in(
    cache_root: &Path,
    audio_path: &Path,
    cover_data: &[u8],
) -> Result<Option<CachedCoverFiles>, String> {
    let mime_type = cover_mime_type_from_data(cover_data)?;
    let cover = CoverImage {
        mime_type: mime_type.to_string(),
        data: cover_data.to_vec(),
    };
    write_cached_cover_files(cache_root, audio_path, &cover, true)
}

fn write_cached_cover_files(
    cache_root: &Path,
    audio_path: &Path,
    cover: &CoverImage,
    overwrite: bool,
) -> Result<Option<CachedCoverFiles>, String> {
    let original_path = cover_original_cache_path(cache_root, audio_path, &cover.mime_type)?;
    let thumbnail_path = cover_thumbnail_cache_path(cache_root, audio_path)?;
    if overwrite {
        remove_other_cached_cover_originals(cache_root, audio_path, &original_path);
    }
    if overwrite || !original_path.is_file() {
        fs::write(&original_path, &cover.data).map_err(|err| err.to_string())?;
    }
    if overwrite || !thumbnail_path.is_file() {
        let thumbnail = create_cover_thumbnail(&cover.data)?;
        fs::write(&thumbnail_path, thumbnail).map_err(|err| err.to_string())?;
    }
    cached_cover_files(&original_path, &thumbnail_path)
}

fn cover_thumbnail_cache_path(cache_root: &Path, audio_path: &Path) -> Result<PathBuf, String> {
    let cache_dir = mono_cache_dir(cache_root).join("cover-thumbnails");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    Ok(cache_dir.join(format!("{}.jpg", cover_cache_key(audio_path))))
}

fn cover_original_cache_path(
    cache_root: &Path,
    audio_path: &Path,
    mime_type: &str,
) -> Result<PathBuf, String> {
    let cache_dir = mono_cache_dir(cache_root).join("cover-originals");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    Ok(cache_dir.join(format!(
        "{}.{}",
        cover_cache_key(audio_path),
        cover_extension(mime_type)
    )))
}

fn find_cached_cover_original_path(cache_root: &Path, audio_path: &Path) -> Option<PathBuf> {
    let cache_dir = mono_cache_dir(cache_root).join("cover-originals");
    let cache_key = cover_cache_key(audio_path);
    ["jpg", "png", "webp"]
        .into_iter()
        .map(|extension| cache_dir.join(format!("{cache_key}.{extension}")))
        .find(|path| path.is_file())
}

fn remove_other_cached_cover_originals(cache_root: &Path, audio_path: &Path, retained_path: &Path) {
    let cache_dir = mono_cache_dir(cache_root).join("cover-originals");
    let cache_key = cover_cache_key(audio_path);
    for extension in ["jpg", "png", "webp"] {
        let path = cache_dir.join(format!("{cache_key}.{extension}"));
        if path != retained_path && path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
}

fn cached_cover_files(
    original_path: &Path,
    thumbnail_path: &Path,
) -> Result<Option<CachedCoverFiles>, String> {
    let original_url = cover_asset_url(original_path);
    let thumbnail_url = cover_asset_url(thumbnail_path);
    Ok(Some(CachedCoverFiles {
        original_path: original_path.to_path_buf(),
        original_url,
        thumbnail_url,
    }))
}

pub(crate) fn write_sidecar_cover_files(
    cache_root: &Path,
    audio_path: &Path,
    cover_path: &Path,
) -> Result<Option<CachedCoverFiles>, String> {
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
    fs::write(&sidecar_path, &data).map_err(|err| err.to_string())?;
    refresh_cached_cover_files_from_data_in(cache_root, audio_path, &data)
}

fn cover_asset_url(path: &Path) -> String {
    let path = path.to_string_lossy().replace('\\', "/");
    asset_url_from_path(&path)
}

#[cfg(any(target_os = "windows", target_os = "android"))]
fn asset_url_from_path(path: &str) -> String {
    format!("http://asset.localhost/{}", encode_uri_component(path))
}

#[cfg(not(any(target_os = "windows", target_os = "android")))]
fn asset_url_from_path(path: &str) -> String {
    format!("asset://localhost/{}", encode_uri_component(path))
}

fn encode_uri_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric()
            || matches!(
                byte,
                b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')'
            )
        {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn read_cover_uncached(audio_path: &Path) -> Result<Option<CoverImage>, String> {
    if let Some(cover) = read_embedded_cover_image(audio_path)? {
        return Ok(Some(cover));
    }

    read_local_cover_image(audio_path)
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

fn cover_mime_type_from_data(data: &[u8]) -> Result<&'static str, String> {
    match image::guess_format(data).map_err(|err| err.to_string())? {
        image::ImageFormat::Jpeg => Ok("image/jpeg"),
        image::ImageFormat::Png => Ok("image/png"),
        image::ImageFormat::WebP => Ok("image/webp"),
        _ => Err("Unsupported artwork image format.".to_string()),
    }
}

fn cover_cache_key(audio_path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    COVER_CACHE_VERSION.hash(&mut hasher);
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

#[cfg(test)]
mod crop_storage_tests {
    use super::*;

    #[test]
    fn crops_create_original_and_thumbnail_without_edit_directory() {
        let root = std::env::temp_dir().join(format!("mono-cover-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let source = root.join("source.jpg");
        image::RgbImage::new(240, 180).save(&source).unwrap();
        for image_data_url in [
            None,
            Some(format!(
                "data:image/jpeg;base64,{}",
                STANDARD.encode(fs::read(&source).unwrap())
            )),
        ] {
            let result = crop_cover_image_in(
                &root,
                CropCoverImageRequest {
                    image_data_url,
                    image_path: source.to_string_lossy().into_owned(),
                    x: 10,
                    y: 10,
                    size: 120,
                },
            )
            .unwrap();
            let original = PathBuf::from(result.path);
            assert_eq!(
                original.parent().unwrap(),
                mono_cache_dir(&root).join("cover-originals")
            );
            assert!(image::open(&original).is_ok());
            let thumbnail = mono_cache_dir(&root)
                .join("cover-thumbnails")
                .join(original.file_name().unwrap());
            let thumbnail = image::open(thumbnail).unwrap();
            assert_eq!((thumbnail.width(), thumbnail.height()), (96, 96));
        }
        assert!(!mono_cache_dir(&root).join("cover-edits").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
