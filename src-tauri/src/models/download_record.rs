use serde::{Deserialize, Serialize};
use crate::downloads::DownloadTrackRequest;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadRecord {
    pub id: String,
    pub title: String,
    #[serde(default, deserialize_with = "super::deserialize_artist_string", serialize_with = "super::serialize_artist_names")]
    pub artist: Option<String>,
    pub album: Option<String>,
    #[serde(default, deserialize_with = "super::deserialize_track_duration")]
    pub duration: Option<u64>,
    pub source_name: String,
    pub source_id: String,
    pub artwork: Option<String>,
    pub status: String,
    pub progress: u8,
    pub created_at: i64,
    pub download_request: Option<DownloadTrackRequest>,
    pub file_path: Option<String>,
    pub lyrics_path: Option<String>,
    pub error: Option<String>,
}
