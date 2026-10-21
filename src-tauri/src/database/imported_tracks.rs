use crate::models::Track;
use rusqlite::{params, Connection};

pub(crate) fn init_table(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS imported_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identity_key TEXT NOT NULL UNIQUE,
        snapshot_json TEXT NOT NULL
    );")
}

pub(crate) fn read(db: &Connection) -> Result<Vec<Track>, String> {
    let mut statement = db.prepare("SELECT snapshot_json FROM imported_tracks ORDER BY id").map_err(|e| e.to_string())?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

// The caller supplies host-resolved metadata, never an untrusted plugin Track object.
pub(crate) fn insert(db: &mut Connection, tracks: &[Track]) -> Result<Vec<Track>, String> {
    let transaction = db.transaction().map_err(|e| e.to_string())?;
    let mut result = Vec::with_capacity(tracks.len());
    for track in tracks {
        let identity = super::favorites::identity_key(track);
        transaction.execute("INSERT INTO imported_tracks(identity_key,snapshot_json) VALUES(?1,?2)
            ON CONFLICT(identity_key) DO NOTHING", params![identity, serde_json::to_string(track).map_err(|e| e.to_string())?])
            .map_err(|e| e.to_string())?;
        let id: i64 = transaction.query_row("SELECT id FROM imported_tracks WHERE identity_key=?1",
            [&identity], |row| row.get(0)).map_err(|e| e.to_string())?;
        let mut track = track.clone();
        track.id = -id;
        transaction.execute("UPDATE imported_tracks SET snapshot_json=?1 WHERE identity_key=?2",
            params![serde_json::to_string(&track).map_err(|e| e.to_string())?, identity]).map_err(|e| e.to_string())?;
        result.push(track);
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn imports_keep_identity_and_refresh_metadata_without_duplicate_rows() {
        let mut db = Connection::open_in_memory().unwrap();
        init_table(&db).unwrap();
        let mut track: Track = serde_json::from_value(json!({"id":0,"path":"plugin://p/song",
            "title":"Before","sourceProviderId":"p","sourceId":"song","sourceRaw":{"token":"private"}})).unwrap();
        let first = insert(&mut db, &[track.clone()]).unwrap();
        track.title = "After".into();
        let updated = insert(&mut db, &[track.clone(), track]).unwrap();
        assert!(first[0].id < 0);
        assert_eq!(first[0].id, updated[0].id);
        assert_eq!(updated[0].id, updated[1].id);
        let saved = read(&db).unwrap();
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].title, "After");
        assert_eq!(saved[0].source_raw.as_ref().unwrap()["token"], "private");
    }

    #[test]
    fn a_failed_batch_rolls_back_all_imports() {
        let mut db = Connection::open_in_memory().unwrap();
        init_table(&db).unwrap();
        db.execute_batch("CREATE TRIGGER reject_second BEFORE INSERT ON imported_tracks
            WHEN (SELECT COUNT(*) FROM imported_tracks) > 0
            BEGIN SELECT RAISE(ABORT, 'test failure'); END;").unwrap();
        let tracks = ["one", "two"].map(|id| serde_json::from_value(json!({
            "id":0,"path":format!("plugin://p/{id}"),"title":id,"sourceProviderId":"p","sourceId":id
        })).unwrap());
        assert!(insert(&mut db, &tracks).is_err());
        assert!(read(&db).unwrap().is_empty());
    }
}
