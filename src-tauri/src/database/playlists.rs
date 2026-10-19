use super::favorites::identity_key;
use crate::{
    database,
    models::{Track, TrackStatistics, UserPlaylist},
};
use rusqlite::{params, Connection};
use std::collections::HashMap;

pub(crate) fn init_tables(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) > 0),
        cover TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        identity_key TEXT NOT NULL,
        local_track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
        snapshot_json TEXT NOT NULL,
        position INTEGER NOT NULL,
        UNIQUE(playlist_id, identity_key)
    );
    CREATE INDEX IF NOT EXISTS playlist_tracks_order ON playlist_tracks(playlist_id, position);
    CREATE INDEX IF NOT EXISTS playlist_tracks_local ON playlist_tracks(local_track_id);",
    )
}

pub(crate) fn read_playlists(db: &Connection) -> Result<Vec<UserPlaylist>, String> {
    let library: HashMap<_, _> = database::read_tracks(db)?
        .into_iter()
        .map(|t| (identity_key(&t), t))
        .collect();
    let mut items: HashMap<String, Vec<Track>> = HashMap::new();
    let mut statement = db.prepare("SELECT playlist_id, identity_key, snapshot_json FROM playlist_tracks ORDER BY position, id").map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (id, key, snapshot) = row.map_err(|e| e.to_string())?;
        let track = match library.get(&key) {
            Some(track) => track.clone(),
            None => serde_json::from_str(&snapshot).map_err(|e| e.to_string())?,
        };
        items.entry(id).or_default().push(track);
    }
    let mut statement = db
        .prepare("SELECT id,name,cover,created_at FROM playlists ORDER BY created_at, rowid")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |r| {
            let id: String = r.get(0)?;
            let tracks = items.remove(&id).unwrap_or_default();
            Ok(UserPlaylist {
                statistics: TrackStatistics::from_tracks(&tracks),
                id,
                name: r.get(1)?,
                cover: r.get(2)?,
                created_at: r.get(3)?,
                track_ids: tracks.iter().map(|t| t.id).collect(),
                tracks,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<_>>()
        .map_err(|e| e.to_string())
}

fn validate_name(db: &Connection, id: &str, name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("歌单名称不能为空".into());
    }
    let duplicate: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM playlists WHERE name=?1 AND id<>?2)",
            params![name.trim(), id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if duplicate {
        return Err("已存在同名歌单".into());
    }
    Ok(())
}

fn require_playlist(db: &Connection, id: &str) -> Result<(), String> {
    let exists: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM playlists WHERE id=?1)",
            [id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err("歌单不存在".into());
    }
    Ok(())
}

pub(crate) fn create(
    db: &Connection,
    name: &str,
    cover: Option<&str>,
    tracks: &[Track],
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    validate_name(db, &id, name)?;
    db.execute(
        "INSERT INTO playlists(id,name,cover,created_at,updated_at) VALUES (?1,?2,?3,?4,?4)",
        params![
            id,
            name.trim(),
            cover.map(str::trim).filter(|s| !s.is_empty()),
            chrono::Utc::now().timestamp_millis()
        ],
    )
    .map_err(|e| e.to_string())?;
    edit_tracks(db, &id, tracks, true)?;
    Ok(id)
}

pub(crate) fn rename(db: &Connection, id: &str, name: &str) -> Result<(), String> {
    require_playlist(db, id)?;
    validate_name(db, id, name)?;
    db.execute(
        "UPDATE playlists SET name=?1,updated_at=?2 WHERE id=?3",
        params![name.trim(), chrono::Utc::now().timestamp_millis(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn update_cover(db: &Connection, id: &str, cover: Option<&str>) -> Result<(), String> {
    require_playlist(db, id)?;
    db.execute(
        "UPDATE playlists SET cover=?1,updated_at=?2 WHERE id=?3",
        params![
            cover.map(str::trim).filter(|s| !s.is_empty()),
            chrono::Utc::now().timestamp_millis(),
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn delete(db: &Connection, id: &str) -> Result<(), String> {
    db.execute("DELETE FROM playlists WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn edit_tracks(
    db: &Connection,
    id: &str,
    tracks: &[Track],
    add: bool,
) -> Result<(), String> {
    require_playlist(db, id)?;
    let library: HashMap<_, _> = database::read_tracks(db)?
        .into_iter()
        .map(|t| (identity_key(&t), t.id))
        .collect();
    let first: i64 = db
        .query_row(
            "SELECT COALESCE(MIN(position),0) FROM playlist_tracks WHERE playlist_id=?1",
            [id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    for (index, track) in tracks.iter().enumerate() {
        if track.path.trim().is_empty() {
            return Err("歌曲路径不能为空".into());
        }
        let key = identity_key(track);
        if add {
            let snapshot = serde_json::to_string(track).map_err(|e| e.to_string())?;
            db.execute("INSERT INTO playlist_tracks(playlist_id,identity_key,local_track_id,snapshot_json,position) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(playlist_id,identity_key) DO NOTHING",
                params![id, key, library.get(&key), snapshot, first - tracks.len() as i64 + index as i64]).map_err(|e| e.to_string())?;
        } else {
            db.execute(
                "DELETE FROM playlist_tracks WHERE playlist_id=?1 AND identity_key=?2",
                params![id, key],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    db.execute(
        "UPDATE playlists SET updated_at=?1 WHERE id=?2",
        params![chrono::Utc::now().timestamp_millis(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn delete_for_music_dir(db: &Connection, root: &std::path::Path) -> Result<(), String> {
    let directory = database::normalized_music_dir(root);
    let prefix = format!("{directory}/");
    for playlist in read_playlists(db)? {
        let tracks: Vec<_> = playlist
            .tracks
            .into_iter()
            .filter(|t| {
                identity_key(t).starts_with("[\"local\",")
                    && database::normalized_track_path(&t.path).starts_with(&prefix)
            })
            .collect();
        if !tracks.is_empty() {
            edit_tracks(db, &playlist.id, &tracks, false)?;
        }
    }
    db.execute("DELETE FROM playlist_tracks WHERE local_track_id IN (SELECT id FROM tracks WHERE music_dir=?1)", [directory]).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
#[path = "playlists_tests.rs"]
mod tests;
