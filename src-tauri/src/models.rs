use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct Track {
    pub(crate) id: i64,
    pub(crate) path: String,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) lyrics: Option<TrackLyrics>,
    #[serde(rename = "rawLyrics")]
    pub(crate) raw_lyrics: Option<String>,
    #[serde(rename = "lyricsSourceName")]
    pub(crate) lyrics_source_name: Option<String>,
    #[serde(rename = "lyricsSourceUrl")]
    pub(crate) lyrics_source_url: Option<String>,
    #[serde(rename = "lyricsFormats", default)]
    pub(crate) lyrics_formats: Vec<String>,
    #[serde(rename = "lyricsDefaultFormat")]
    pub(crate) lyrics_default_format: Option<String>,
    #[serde(rename = "lyricsFormat")]
    pub(crate) lyrics_format: Option<String>,
    #[serde(rename = "lyricsProviderId")]
    pub(crate) lyrics_provider_id: Option<String>,
    #[serde(rename = "lyricsTrackId")]
    pub(crate) lyrics_track_id: Option<String>,
    #[serde(rename = "lyricsTrackRaw")]
    pub(crate) lyrics_track_raw: Option<serde_json::Value>,
    #[serde(rename = "sourceId")]
    pub(crate) source_id: Option<String>,
    #[serde(rename = "sourceName")]
    pub(crate) source_name: Option<String>,
    #[serde(rename = "sourceProviderId")]
    pub(crate) source_provider_id: Option<String>,
    #[serde(rename = "sourceRaw")]
    pub(crate) source_raw: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrackLyrics {
    pub(crate) raw_lyrics: Option<String>,
    pub(crate) lyrics_url: Option<String>,
    pub(crate) formats: Vec<String>,
    pub(crate) default_format: Option<String>,
    pub(crate) format: Option<String>,
    pub(crate) provider_id: Option<String>,
    pub(crate) provider_name: Option<String>,
    pub(crate) track_id: Option<String>,
    pub(crate) track_raw: Option<serde_json::Value>,
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

#[derive(Debug, Deserialize)]
pub(crate) struct ThemePackageManifest {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) author: Option<String>,
    pub(crate) entry: Option<String>,
    pub(crate) preview: Option<String>,
    pub(crate) background: Option<String>,
    #[serde(rename = "backgroundOpacity")]
    pub(crate) background_opacity: Option<f64>,
}

#[derive(Debug, Serialize)]
pub(crate) struct ImportedTheme {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) author: String,
    pub(crate) variables: HashMap<String, String>,
    pub(crate) preview: Option<String>,
    pub(crate) background: Option<String>,
    #[serde(rename = "backgroundOpacity")]
    pub(crate) background_opacity: Option<f64>,
}
