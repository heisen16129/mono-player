use super::{library, providers};
use crate::models::{plugin_api::{Error, Result}, TrackLyrics};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::AppHandle;

fn public_bundle(bundle: Option<TrackLyrics>) -> Value {
    json!({"lyrics":bundle.into_iter().flat_map(|bundle| bundle.lyrics)
        .map(|variant| json!({"format":variant.format,"content":variant.content})).collect::<Vec<_>>()})
}

pub(super) fn parse(params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Input { content: String, format: Option<String> }
    let input: Input = serde_json::from_value(params.clone())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "Expected lyrics content and optional format"))?;
    if input.content.len() > 1024 * 1024 {
        return Err(Error::new("INVALID_ARGUMENT", "Lyrics content exceeds 1 MiB"));
    }
    if input.format.as_deref().is_some_and(|format| !matches!(format, "lrc" | "yrc" | "qrc" | "krc" | "a2" | "txt" | "trans")) {
        return Err(Error::new("INVALID_ARGUMENT", "Unknown lyrics format"));
    }
    serde_json::to_value(crate::lyrics::parse_lyrics_content_with_format(&input.content, input.format.as_deref()))
        .map_err(|_| Error::new("INTERNAL", "Cannot serialize parsed lyrics"))
}

pub(super) fn get(app: &AppHandle, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Get { track_id: String }
    let input: Get = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected trackId"))?;
    let track = library::resolve_in_app(app, &input.track_id)?;
    if let Some(bundle) = track.associated_lyrics.as_ref().or(track.lyrics.as_ref()) { return Ok(public_bundle(Some(bundle.clone()))); }
    let bundle = if let Some(provider_id) = &track.source_provider_id {
        let provider = providers::installed(app, "lyrics")?.into_iter().find(|p| p["id"] == *provider_id)
            .ok_or_else(|| Error::new("NOT_FOUND", "Lyrics provider is unavailable"))?;
        let data = providers::invoke(app, &provider, json!({"action":"lyrics","track":track}))?;
        serde_json::from_value(data).map_err(|_| Error::new("INTERNAL", "Provider returned invalid lyrics"))?
    } else {
        crate::lyrics::read_local_lyrics_bundle_for_track(&track.path, Some(&track.title), track.artist.as_deref())
            .map_err(|_| Error::new("INTERNAL", "Cannot read lyrics"))?
    };
    Ok(public_bundle(bundle))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_lrc_and_word_timing_with_host_parser_in_seconds() {
        let lrc = parse(&json!({"format":"lrc","content":"[00:01.50]歌词"})).unwrap();
        assert_eq!(lrc[0]["time"], 1.5);
        assert_eq!(lrc[0]["text"], "歌词");
        let input = "[1000,2000]参(0,300,0)与(300,300,0)任";
        let parsed = parse(&json!({"format":"yrc","content":input})).unwrap();
        let expected = serde_json::to_value(crate::lyrics::parse_lyrics_content_with_format(input, Some("yrc"))).unwrap();
        assert_eq!(parsed, expected);
        assert!(parsed[0]["words"].as_array().is_some_and(|words| !words.is_empty()));
        assert_eq!(parse(&json!({"content":""})).unwrap(), json!([]));
    }
    #[test]
    fn parsing_rejects_paths_unknown_formats_and_oversized_input() {
        for input in [json!({"content":"text","path":"C:/private"}), json!({"content":"text","format":"unknown"}),
            json!({"content":1}), json!({"content":"a".repeat(1024*1024+1)})] {
            assert_eq!(parse(&input).unwrap_err().code, "INVALID_ARGUMENT");
        }
    }
    #[test]
    fn does_not_expose_paths_or_provider_credentials_in_lyrics() {
        let bundle = serde_json::from_value(json!({"providerId":"provider","trackRaw":{"token":"secret"},"lyrics":[{"format":"lrc","content":"[00:01]歌词","sourceUrl":"C:/private/song.lrc"}]})).unwrap();
        assert_eq!(public_bundle(Some(bundle)), json!({"lyrics":[{"format":"lrc","content":"[00:01]歌词"}]}));
        assert_eq!(public_bundle(None), json!({"lyrics":[]}));
    }
}
