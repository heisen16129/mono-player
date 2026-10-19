use serde::Serialize;
use super::{Track, TrackStatistics};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectorySnapshot {
    pub(crate) music_dirs: Vec<String>,
    pub(crate) music_dir: String,
    pub(crate) tracks: Vec<Track>,
    pub(crate) latest_added_tracks: Vec<Track>,
    pub(crate) statistics: TrackStatistics,
}
