use crate::{
    database,
    models::{Favorite, Track},
};
use rusqlite::{params, Connection};

pub(crate) fn init_table(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identity_key TEXT NOT NULL UNIQUE,
            local_track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
            source_provider_id TEXT,
            source_track_id TEXT,
            snapshot_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS favorites_local_track ON favorites(local_track_id);",
    )
}

pub(crate) fn identity_key(track: &Track) -> String {
    let remote = track.path.starts_with("plugin://")
        || track.path.to_ascii_lowercase().starts_with("http://")
        || track.path.to_ascii_lowercase().starts_with("https://");
    if remote {
        let provider = track
            .source_provider_id
            .as_deref()
            .filter(|s| !s.is_empty())
            .or(track.source_name.as_deref())
            .unwrap_or("");
        if let Some(id) = track.source_id.as_deref().filter(|s| !s.is_empty()) {
            if !provider.is_empty() {
                return serde_json::json!(["source", provider, id]).to_string();
            }
        }
        return serde_json::json!(["url", track.path]).to_string();
    }
    let path = track.path.replace('\\', "/");
    let path = path
        .strip_prefix("//?/")
        .unwrap_or(&path)
        .trim_end_matches('/');
    serde_json::json!(["local", path.to_lowercase()]).to_string()
}

pub(crate) fn read_favorites(db: &Connection) -> Result<Vec<Favorite>, String> {
    let library = database::read_tracks(db)?
        .into_iter()
        .map(|track| (identity_key(&track), track))
        .collect::<std::collections::HashMap<_, _>>();
    let mut statement = db.prepare(
        "SELECT id, identity_key, snapshot_json FROM favorites ORDER BY created_at DESC, id DESC",
    ).map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    rows.map(|row| {
        let (id, identity_key, snapshot) = row.map_err(|e| e.to_string())?;
        let track = match library.get(&identity_key) {
            Some(track) => track.clone(),
            None => serde_json::from_str(&snapshot).map_err(|e| e.to_string())?,
        };
        Ok(Favorite {
            id,
            identity_key,
            track,
        })
    })
    .collect()
}

pub(crate) fn insert_favorite(db: &Connection, track: &Track) -> Result<(), String> {
    if track.path.trim().is_empty() {
        return Err("歌曲路径不能为空".into());
    }
    let key = identity_key(track);
    let local = database::read_tracks(db)?
        .into_iter()
        .find(|t| identity_key(t) == key);
    let snapshot = serde_json::to_string(track).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO favorites (identity_key, local_track_id, source_provider_id, source_track_id, snapshot_json)
         VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(identity_key) DO NOTHING",
        params![key, local.map(|t| t.id), track.source_provider_id, track.source_id, snapshot],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn delete_favorite(db: &Connection, id: i64) -> Result<(), String> {
    db.execute("DELETE FROM favorites WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn delete_for_music_dir(db: &Connection, root: &std::path::Path) -> Result<(), String> {
    let directory = database::normalized_music_dir(root);
    let prefix = format!("{directory}/");
    for entry in read_favorites(db)? {
        if entry.identity_key.starts_with("[\"local\",")
            && database::normalized_track_path(&entry.track.path).starts_with(&prefix)
        {
            delete_favorite(db, entry.id)?;
        }
    }
    db.execute(
        "DELETE FROM favorites WHERE local_track_id IN (SELECT id FROM tracks WHERE music_dir = ?1)",
        [directory],
    ).map_err(|err| err.to_string())?;
    Ok(())
}

#[cfg(test)]
#[path = "favorites_tests.rs"]
mod tests;
