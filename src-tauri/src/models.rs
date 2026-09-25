use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct Track {
    pub(crate) id: i64,
    pub(crate) path: String,
    pub(crate) title: String,
    #[serde(
        default,
        deserialize_with = "deserialize_artist_string",
        serialize_with = "serialize_artist_names"
    )]
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    #[serde(default, deserialize_with = "deserialize_track_duration")]
    pub(crate) duration: Option<u64>,
    #[serde(rename = "addedAt")]
    pub(crate) added_at: Option<String>,
    #[serde(rename = "scanId")]
    pub(crate) scan_id: Option<String>,
    pub(crate) year: Option<u32>,
    pub(crate) genre: Option<String>,
    #[serde(rename = "trackNumber")]
    pub(crate) track_number: Option<u32>,
    pub(crate) artwork: Option<String>,
    #[serde(rename = "associatedArtwork", skip_serializing_if = "Option::is_none")]
    pub(crate) associated_artwork: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) lyrics: Option<TrackLyrics>,
    #[serde(rename = "associatedLyrics", skip_serializing_if = "Option::is_none")]
    pub(crate) associated_lyrics: Option<TrackLyrics>,
    #[serde(rename = "sourceId")]
    pub(crate) source_id: Option<String>,
    #[serde(rename = "sourceName")]
    pub(crate) source_name: Option<String>,
    #[serde(rename = "sourceProviderId")]
    pub(crate) source_provider_id: Option<String>,
    #[serde(rename = "sourceRaw")]
    pub(crate) source_raw: Option<serde_json::Value>,
}

fn deserialize_track_duration<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: Deserializer<'de>,
{
    let Some(number) = Option::<serde_json::Number>::deserialize(deserializer)? else {
        return Ok(None);
    };
    if let Some(seconds) = number.as_u64() {
        return Ok(Some(seconds));
    }
    match number.as_f64() {
        Some(seconds) if seconds.is_finite() && seconds >= 0.0 && seconds < u64::MAX as f64 => {
            Ok(Some(seconds.trunc() as u64))
        }
        _ => Err(serde::de::Error::custom("expected non-negative duration in seconds")),
    }
}

pub(crate) fn deserialize_artist_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(normalize_artist_value(value.as_ref()))
}

pub(crate) fn serialize_artist_names<S>(
    artist: &Option<String>,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let names = artist.as_deref().map(artist_names).unwrap_or_default();
    names.serialize(serializer)
}

pub(crate) fn artist_names(value: &str) -> Vec<String> {
    value
        .split(is_artist_separator)
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect()
}

fn is_artist_separator(character: char) -> bool {
    matches!(character, '/' | ',' | '&' | ';' | '|' | '_')
        || matches!(character as u32, 0x3001 | 0xFF0C | 0xFF1B)
}

fn normalize_artist_value(value: Option<&serde_json::Value>) -> Option<String> {
    match value? {
        serde_json::Value::String(artist) => non_empty_artist(artist),
        serde_json::Value::Array(artists) => {
            let names = artists
                .iter()
                .filter_map(|artist| artist.as_str())
                .filter_map(non_empty_artist)
                .collect::<Vec<_>>();
            (!names.is_empty()).then(|| names.join(" & "))
        }
        _ => None,
    }
}

fn non_empty_artist(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrackLyrics {
    pub(crate) provider_id: Option<String>,
    pub(crate) provider_name: Option<String>,
    pub(crate) track_id: Option<String>,
    pub(crate) default_format: Option<String>,
    pub(crate) lyrics: Vec<TrackLyricVariant>,
    pub(crate) track_raw: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrackLyricVariant {
    pub(crate) format: String,
    pub(crate) content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) source_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) quality: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct LyricLine {
    pub(crate) time: Option<f64>,
    pub(crate) text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) words: Option<Vec<LyricWord>>,
}

#[derive(Debug, Serialize)]
pub(crate) struct LyricWord {
    pub(crate) time: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) duration: Option<f64>,
    pub(crate) text: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct CoverImage {
    pub(crate) mime_type: String,
    pub(crate) data: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct WallpaperThemeColor {
    pub(crate) r: u8,
    pub(crate) g: u8,
    pub(crate) b: u8,
    pub(crate) path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct SystemThemeState {
    pub(crate) mode: String,
    #[serde(rename = "appsUseLightTheme")]
    pub(crate) apps_use_light_theme: bool,
    #[serde(rename = "systemUsesLightTheme")]
    pub(crate) system_uses_light_theme: bool,
    #[serde(rename = "wallpaperColor")]
    pub(crate) wallpaper_color: Option<WallpaperThemeColor>,
}

#[cfg(test)]
mod tests {
    #[test]
    fn download_request_accepts_playback_and_search_durations() {
        for (duration, expected) in [
            (serde_json::json!(194.4), Some(194)),
            (serde_json::json!(194), Some(194)),
            (serde_json::Value::Null, None),
        ] {
            let request: crate::downloads::DownloadTrackRequest = serde_json::from_value(serde_json::json!({
                "downloadDir": "downloads", "plugins": [],
                "track": { "id": 1, "path": "plugin://song", "title": "Love Me More", "duration": duration }
            })).unwrap();
            assert_eq!(request.track.duration, expected);
        }
        for duration in [serde_json::json!(-1), serde_json::json!("194.4")] {
            assert!(serde_json::from_value::<super::Track>(serde_json::json!({
                "id": 1, "path": "plugin://song", "title": "song", "duration": duration
            })).is_err());
        }
    }
}
