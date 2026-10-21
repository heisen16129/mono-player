use crate::models::{plugin_api::{Error, Result}, CoverImage};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

fn resource(image: CoverImage) -> Value {
    json!({"url":format!("data:{};base64,{}", image.mime_type, STANDARD.encode(image.data))})
}

pub(super) fn dispatch(app: &AppHandle, method: &str, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Get { artwork_ref: String }
    let input: Get = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected artworkRef"))?;
    let id = input.artwork_ref.strip_prefix("artwork:").filter(|id| id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or_else(|| Error::new("INVALID_ARGUMENT", "Invalid artworkRef"))?;
    let track = super::library::resolve_in_app(app, &format!("track:{id}"))?;
    let failure = || Error::new("INTERNAL", "Cannot read artwork");
    let mut source = track.associated_artwork.clone().or(track.artwork.clone());
    if track.source_provider_id.is_none() && track.associated_artwork.is_none() && std::path::Path::new(&track.path).is_file() {
        let state = app.state::<crate::player::PlayerState>();
        let root = state.cache_dir().map_err(|_| failure())?;
        let files = if method == "artwork.refresh" {
            crate::covers::refresh_cached_cover_files_in(&root, std::path::Path::new(&track.path))
        } else {
            crate::covers::cached_cover_files_in(&root, std::path::Path::new(&track.path))
        }.map_err(|_| failure())?;
        if let Some(files) = files { source = Some(files.original_path.to_string_lossy().into_owned()); }
        if method == "artwork.refresh" {
            state.publish_track_cover_change(app, track.id, &track.path, source.clone(), track.associated_artwork.clone());
        }
    }
    let source = source.ok_or_else(|| Error::new("NOT_FOUND", "Track has no artwork"))?;
    // Return image contents rather than filesystem paths or credential-bearing provider URLs.
    let image = if source.starts_with("https://") || source.starts_with("http://") {
        let response = crate::covers::read_remote_cover(source);
        if response.code != 1 { return Err(failure()); }
        response.data
    } else {
        let response = crate::covers::read_artwork_file(source);
        if response.code != 1 { return Err(failure()); }
        response.data.flatten()
    }.ok_or_else(|| Error::new("NOT_FOUND", "Track has no artwork"))?;
    if method == "artwork.refresh" { Ok(Value::Null) } else { Ok(resource(image)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resource_contains_bytes_without_local_filename() {
        assert_eq!(resource(CoverImage { mime_type:"image/png".into(),data:vec![1,2,3] }), json!({"url":"data:image/png;base64,AQID"}));
    }
}
