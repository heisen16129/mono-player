use rusqlite::{Connection, OptionalExtension};

pub(crate) fn init_table(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS playback_session (
        id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL
    );",
    )
}

pub(crate) fn read(db: &Connection) -> Result<Option<String>, String> {
    db.query_row(
        "SELECT payload FROM playback_session WHERE id=1",
        [],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub(crate) fn save(db: &Connection, payload: &str) -> Result<(), String> {
    db.execute(
        "INSERT INTO playback_session(id,payload) VALUES(1,?1)
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload
        WHERE playback_session.payload != excluded.payload",
        [payload],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replaces_single_session_and_skips_unchanged_writes() {
        let db = Connection::open_in_memory().unwrap();
        init_table(&db).unwrap();
        assert_eq!(read(&db).unwrap(), None);
        save(&db, "first").unwrap();
        save(&db, "first").unwrap();
        assert_eq!(db.changes(), 0);
        save(&db, "second").unwrap();
        assert_eq!(read(&db).unwrap().as_deref(), Some("second"));
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM playback_session", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
}
