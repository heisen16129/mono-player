use crate::models::{
    artist_names, LibraryListStatistics, LibrarySearchResult, Track, TrackStatistics,
};
use rusqlite::Connection;

pub(super) fn matches_query(track: &Track, query: &str) -> bool {
    query.is_empty()
        || track.title.to_lowercase().contains(query)
        || artist_names(track.artist.as_deref().unwrap_or(""))
            .join(" & ")
            .to_lowercase()
            .contains(query)
        || track
            .album
            .as_deref()
            .unwrap_or("")
            .to_lowercase()
            .contains(query)
}

pub(crate) fn read(db: &Connection, query: &str) -> Result<LibrarySearchResult, String> {
    let query = query.trim().to_lowercase();
    let mut tracks = super::read_tracks(db)?;
    let mut latest_added_tracks = super::read_latest_added_tracks(db)?;
    let mut recent_played_tracks = super::recent_played::read(db)?;
    let totals = LibraryListStatistics {
        tracks: TrackStatistics::from_tracks(&tracks),
        latest_added_tracks: TrackStatistics::from_tracks(&latest_added_tracks),
        recent_played_tracks: TrackStatistics::from_tracks(&recent_played_tracks),
    };
    for list in [
        &mut tracks,
        &mut latest_added_tracks,
        &mut recent_played_tracks,
    ] {
        list.retain(|track| matches_query(track, &query));
    }
    let statistics = LibraryListStatistics {
        tracks: TrackStatistics::from_tracks(&tracks),
        latest_added_tracks: TrackStatistics::from_tracks(&latest_added_tracks),
        recent_played_tracks: TrackStatistics::from_tracks(&recent_played_tracks),
    };
    Ok(LibrarySearchResult {
        tracks,
        latest_added_tracks,
        recent_played_tracks,
        statistics,
        totals,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn searches_title_artist_album_and_returns_all_without_paging() {
        let db = Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        for id in 1..=120 {
            db.execute(
                "INSERT INTO tracks(id,path,title,artist,album) VALUES(?1,?2,?3,?4,?5)",
                params![id, format!("/{id}.mp3"), "歌曲 Alpha", "歌手", "专辑"],
            )
            .unwrap();
        }
        for query in ["", " ALPHA ", "歌手", "专辑"] {
            assert_eq!(read(&db, query).unwrap().tracks.len(), 120);
        }
        assert!(read(&db, "%").unwrap().tracks.is_empty());
    }

    #[test]
    fn filters_inside_latest_scan_batches_and_latest_100_played() {
        let db = Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        for id in 1..=105 {
            db.execute(
                "INSERT INTO tracks(id,path,title,added_at,scan_id,last_played_at)
                VALUES(?1,?2,?3,?4,?5,?1)",
                params![
                    id,
                    format!("/{id}.mp3"),
                    if id == 1 || id == 105 {
                        "Match"
                    } else {
                        "Other"
                    },
                    if id == 105 {
                        "2026-10-16 10:00:00"
                    } else {
                        "2026-10-15 10:00:00"
                    },
                    if id == 105 { "new" } else { "old" }
                ],
            )
            .unwrap();
        }
        let result = read(&db, "match").unwrap();
        assert_eq!(result.tracks.len(), 2);
        assert_eq!(
            result
                .latest_added_tracks
                .iter()
                .map(|t| t.id)
                .collect::<Vec<_>>(),
            vec![105]
        );
        assert_eq!(
            result
                .recent_played_tracks
                .iter()
                .map(|t| t.id)
                .collect::<Vec<_>>(),
            vec![105]
        );
        let result = read(&db, "").unwrap();
        assert_eq!(result.recent_played_tracks.len(), 100);
        assert_eq!(result.recent_played_tracks[0].id, 105);
        assert_eq!(result.recent_played_tracks[99].id, 6);
    }
}
