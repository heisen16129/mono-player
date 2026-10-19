use crate::models::Track;
use rusqlite::{params, Connection};

pub(crate) fn record(db: &Connection, path: &str, timestamp: i64) -> Result<bool, String> {
    let Some(path) = super::find_existing_track_path(db, path)? else {
        return Ok(false);
    };
    db.execute(
        "UPDATE tracks SET last_played_at=?1 WHERE path=?2",
        params![timestamp, path],
    )
    .map(|count| count > 0)
    .map_err(|e| e.to_string())
}

pub(crate) fn read(db: &Connection) -> Result<Vec<Track>, String> {
    let mut statement = db
        .prepare(
            "SELECT id,path,title,artist,album,duration,added_at,scan_id,artwork,last_played_at
        FROM tracks WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC, id DESC LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], super::track_from_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<_>>()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;

    #[test]
    fn returns_only_the_latest_100_without_deleting_history() {
        let db = Connection::open_in_memory().unwrap();
        database::init_database(&db).unwrap();
        for id in 1..=105 {
            db.execute(
                "INSERT INTO tracks(id,path,title,last_played_at) VALUES(?1,?2,'Song',?1)",
                params![id, format!("C:/Music/{id}.mp3")],
            ).unwrap();
        }
        let tracks = read(&db).unwrap();
        assert_eq!(tracks.len(), 100);
        assert_eq!(tracks.first().unwrap().id, 105);
        assert_eq!(tracks.last().unwrap().id, 6);
        assert!(tracks.windows(2).all(|pair| pair[0].last_played_at > pair[1].last_played_at));
        assert_eq!(database::read_tracks(&db).unwrap().len(), 105);
    }

    #[test]
    fn scan_starts_empty_playback_orders_and_rescan_preserves_time() {
        let db = Connection::open_in_memory().unwrap();
        database::init_database(&db).unwrap();
        for (id, path) in [(1, "C:/Music/a.mp3"), (2, "C:/Music/b.mp3")] {
            let track: Track =
                serde_json::from_value(serde_json::json!({"id":id,"path":path,"title":"Song"}))
                    .unwrap();
            database::upsert_track(
                &db,
                &track,
                Some("scan"),
                Some(std::path::Path::new("C:/Music")),
            )
            .unwrap();
        }
        assert!(read(&db).unwrap().is_empty());
        assert!(database::read_tracks(&db)
            .unwrap()
            .iter()
            .all(|t| t.last_played_at.is_none()));
        record(&db, "c:\\music\\a.mp3", 1000).unwrap();
        record(&db, "C:/Music/b.mp3", 2000).unwrap();
        assert!(read(&db).unwrap()[0].path.ends_with("b.mp3"));
        record(&db, "C:/Music/a.mp3", 3000).unwrap();
        let played = read(&db).unwrap();
        assert_eq!(played.len(), 2);
        assert!(played[0].path.ends_with("a.mp3"));
        database::upsert_track(
            &db,
            &played[0],
            Some("rescan"),
            Some(std::path::Path::new("C:/Music")),
        )
        .unwrap();
        assert_eq!(read(&db).unwrap()[0].last_played_at, Some(3000));
        assert!(!record(&db, "https://example.com/song.mp3", 4000).unwrap());
        database::delete_tracks_for_music_dir(&db, std::path::Path::new("C:/Music")).unwrap();
        assert!(read(&db).unwrap().is_empty());
    }

    #[test]
    fn existing_database_adds_nullable_column_without_inventing_history() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE tracks(id INTEGER PRIMARY KEY, path TEXT UNIQUE, title TEXT,artist TEXT,album TEXT,duration INTEGER,updated_at TEXT); INSERT INTO tracks(id,path,title) VALUES(1,'C:/song.mp3','Song');").unwrap();
        database::init_database(&db).unwrap();
        assert!(read(&db).unwrap().is_empty());
        assert!(record(&db, "C:/song.mp3", 1234).unwrap());
        database::init_database(&db).unwrap();
        assert_eq!(read(&db).unwrap()[0].last_played_at, Some(1234));
    }
}
