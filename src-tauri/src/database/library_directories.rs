use rusqlite::{Connection, OptionalExtension};

pub(crate) fn init_table(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS library_directories (id INTEGER PRIMARY KEY CHECK(id=1), paths_json TEXT NOT NULL);")
}
pub(crate) fn read(db: &Connection) -> Result<Option<Vec<String>>, String> {
    let raw: Option<String> = db.query_row("SELECT paths_json FROM library_directories WHERE id=1", [], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
    raw.map(|raw| serde_json::from_str(&raw).map_err(|e| e.to_string())).transpose()
}
pub(crate) fn save(db: &Connection, paths: &[String]) -> Result<(), String> {
    let raw = serde_json::to_string(paths).map_err(|e| e.to_string())?;
    db.execute("INSERT INTO library_directories(id,paths_json) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET paths_json=excluded.paths_json", [raw]).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_directory_list_is_distinct_from_unmigrated_settings() {
        let db = Connection::open_in_memory().unwrap();
        init_table(&db).unwrap();
        assert_eq!(read(&db).unwrap(), None);
        save(&db, &[]).unwrap();
        assert_eq!(read(&db).unwrap(), Some(vec![]));
    }
    #[test]
    fn directory_change_and_library_deletion_roll_back_together() {
        let mut db = Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        save(&db, &["C:/Music".into()]).unwrap();
        db.execute("INSERT INTO tracks(id,path,title,music_dir) VALUES(1,'C:/Music/song.mp3','Song','c:/music')",[]).unwrap();
        let track = crate::database::read_tracks(&db).unwrap().remove(0);
        crate::database::favorites::insert_favorite(&db,&track).unwrap();
        crate::database::playlists::create(&db,"List",None,&[track]).unwrap();
        db.execute_batch("CREATE TRIGGER reject_directory_save BEFORE UPDATE ON library_directories BEGIN SELECT RAISE(ABORT,'disk failure'); END;").unwrap();
        {
            let tx = db.transaction().unwrap();
            crate::database::delete_tracks_for_music_dir_in_transaction(&tx,std::path::Path::new("C:/Music")).unwrap();
            assert!(save(&tx, &[]).is_err());
        }
        assert_eq!(read(&db).unwrap(),Some(vec!["C:/Music".into()]));
        assert_eq!(crate::database::read_tracks(&db).unwrap().len(),1);
        assert_eq!(crate::database::favorites::read_favorites(&db).unwrap().len(),1);
        assert_eq!(crate::database::playlists::read_playlists(&db).unwrap()[0].tracks.len(),1);
        db.execute_batch("DROP TRIGGER reject_directory_save").unwrap();
        let tx = db.transaction().unwrap();
        crate::database::delete_tracks_for_music_dir_in_transaction(&tx,std::path::Path::new("C:/Music")).unwrap();
        save(&tx,&[]).unwrap();
        tx.commit().unwrap();
        assert_eq!(read(&db).unwrap(),Some(vec![]));
        assert!(crate::database::read_tracks(&db).unwrap().is_empty());
        assert!(crate::database::favorites::read_favorites(&db).unwrap().is_empty());
    }
}
