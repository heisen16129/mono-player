use super::*;
use serde_json::json;

fn track(id: i64, path: &str) -> Track {
    serde_json::from_value(json!({
        "id": id, "path": path, "title": "Song", "artist": ["Artist"],
        "album": null, "duration": 42
    }))
    .unwrap()
}

fn database() -> Connection {
    let db = Connection::open_in_memory().unwrap();
    database::init_database(&db).unwrap();
    db
}

#[test]
fn local_favorites_resolve_rescanned_tracks() {
    let db = database();
    db.execute(
        "INSERT INTO tracks (id,path,title) VALUES (1,'C:/Music/song.mp3','Original')",
        [],
    )
    .unwrap();
    insert_favorite(&db, &track(1, "C:\\Music\\song.mp3")).unwrap();
    insert_favorite(&db, &track(999, "c:/music/SONG.mp3")).unwrap();
    assert_eq!(read_favorites(&db).unwrap().len(), 1);
    db.execute("DELETE FROM tracks WHERE id = 1", []).unwrap();
    let link: Option<i64> = db
        .query_row("SELECT local_track_id FROM favorites", [], |r| r.get(0))
        .unwrap();
    assert_eq!(link, None);
    assert_eq!(read_favorites(&db).unwrap()[0].track.title, "Song");
    db.execute(
        "INSERT INTO tracks (id,path,title) VALUES (2,'C:/Music/song.mp3','Rescanned')",
        [],
    )
    .unwrap();
    let entries = read_favorites(&db).unwrap();
    assert_eq!(entries[0].track.id, 2);
    assert_eq!(entries[0].track.title, "Rescanned");
    delete_favorite(&db, entries[0].id).unwrap();
    delete_favorite(&db, entries[0].id).unwrap();
    assert!(read_favorites(&db).unwrap().is_empty());
    assert_eq!(database::read_tracks(&db).unwrap().len(), 1);
}

#[test]
fn removing_music_directory_removes_only_its_local_favorites() {
    let db = database();
    db.execute("INSERT INTO tracks (id,path,title,music_dir) VALUES (1,'C:/Music/song.mp3','Song','c:/music')", []).unwrap();
    insert_favorite(&db, &track(1, "C:/Music/song.mp3")).unwrap();
    // A snapshot whose library record is already gone must also be removed.
    insert_favorite(&db, &track(2, "C:\\Music\\sub\\missing.mp3")).unwrap();
    insert_favorite(&db, &track(3, "C:/Music-other/keep.mp3")).unwrap();
    insert_favorite(&db, &track(4, "https://example.com/music/song.mp3")).unwrap();
    database::delete_tracks_for_music_dir(&db, std::path::Path::new("c:/MUSIC/")).unwrap();
    let entries = read_favorites(&db).unwrap();
    assert_eq!(entries.len(), 2);
    assert!(entries.iter().all(|entry| [3, 4].contains(&entry.track.id)));
    assert!(database::read_tracks(&db).unwrap().is_empty());
    database::delete_tracks_for_music_dir(&db, std::path::Path::new("c:/music")).unwrap();
    assert_eq!(read_favorites(&db).unwrap().len(), 2);
}

#[test]
fn remote_identity_uses_provider_and_source_instead_of_numeric_id_or_url() {
    let db = database();
    let mut first = track(-1, "https://example.com/old-token");
    first.source_provider_id = Some("provider-a".into());
    first.source_id = Some("42".into());
    first.source_raw = Some(json!({"id": "42", "quality": "lossless"}));
    insert_favorite(&db, &first).unwrap();
    let mut refreshed = first.clone();
    refreshed.id = -200;
    refreshed.path = "https://example.com/new-token".into();
    insert_favorite(&db, &refreshed).unwrap();
    let mut other = first.clone();
    other.source_provider_id = Some("provider-b".into());
    insert_favorite(&db, &other).unwrap();
    let entries = read_favorites(&db).unwrap();
    assert_eq!(entries.len(), 2);
    assert_ne!(entries[0].identity_key, entries[1].identity_key);
    assert_eq!(
        entries[0].track.source_provider_id.as_deref(),
        Some("provider-b")
    );
    assert_eq!(entries[1].track.source_raw, first.source_raw);
}

#[test]
fn favorites_persist_across_connections() {
    let path = std::env::temp_dir().join(format!("mono-favorites-{}.sqlite", uuid::Uuid::new_v4()));
    {
        let db = Connection::open(&path).unwrap();
        database::init_database(&db).unwrap();
        insert_favorite(&db, &track(7, "D:/song.flac")).unwrap();
    }
    {
        let db = Connection::open(&path).unwrap();
        database::init_database(&db).unwrap();
        let entries = read_favorites(&db).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].track.path, "D:/song.flac");
    }
    std::fs::remove_file(path).unwrap();
}

#[test]
fn invalid_favorite_does_not_write_a_row() {
    let db = database();
    assert!(insert_favorite(&db, &track(1, "")).is_err());
    assert!(read_favorites(&db).unwrap().is_empty());
}
