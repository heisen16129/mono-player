use super::*;
use serde_json::json;

fn track(id: i64, path: &str) -> Track {
    serde_json::from_value(
        json!({"id":id,"path":path,"title":"Song","artist":["Artist"],"duration":90}),
    )
    .unwrap()
}

fn db() -> Connection {
    let db = Connection::open_in_memory().unwrap();
    database::init_database(&db).unwrap();
    db
}

#[test]
fn mixed_tracks_preserve_order_and_deduplicate_by_source() {
    let db = db();
    let local = track(1, "C:/Music/song.mp3");
    let mut online = track(1, "https://example.com/old");
    online.source_provider_id = Some("provider-a".into());
    online.source_id = Some("42".into());
    online.source_raw = Some(json!({"songId":"42","quality":"lossless"}));
    let id = create(&db, " Mixed ", None, &[local.clone(), online.clone()]).unwrap();
    let mut refreshed = online.clone();
    refreshed.path = "https://example.com/new".into();
    refreshed.id = 999;
    edit_tracks(&db, &id, &[refreshed.clone()], true).unwrap();
    let mut other = online.clone();
    other.source_provider_id = Some("provider-b".into());
    edit_tracks(&db, &id, &[other], true).unwrap();
    let lists = read_playlists(&db).unwrap();
    assert_eq!(lists[0].tracks.len(), 3);
    assert_eq!(
        lists[0].tracks[0].source_provider_id.as_deref(),
        Some("provider-b")
    );
    assert_eq!(lists[0].tracks[1].path, local.path);
    assert_eq!(lists[0].tracks[2].source_raw, online.source_raw);
    edit_tracks(&db, &id, &[refreshed], false).unwrap();
    assert_eq!(read_playlists(&db).unwrap()[0].tracks.len(), 2);
}

#[test]
fn deleting_playlist_does_not_delete_other_playlists_library_or_favorites() {
    let db = db();
    db.execute(
        "INSERT INTO tracks(id,path,title) VALUES(1,'C:/Music/song.mp3','Song')",
        [],
    )
    .unwrap();
    let song = track(1, "C:/Music/song.mp3");
    super::super::favorites::insert_favorite(&db, &song).unwrap();
    let first = create(&db, "First", None, &[song.clone()]).unwrap();
    create(&db, "Second", None, &[song]).unwrap();
    delete(&db, &first).unwrap();
    delete(&db, &first).unwrap();
    assert_eq!(read_playlists(&db).unwrap()[0].tracks.len(), 1);
    assert_eq!(database::read_tracks(&db).unwrap().len(), 1);
    assert_eq!(
        super::super::favorites::read_favorites(&db).unwrap().len(),
        1
    );
    let count: i64 = db
        .query_row("SELECT COUNT(*) FROM playlist_tracks", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn directory_removal_cleans_all_playlists_but_keeps_online_tracks_and_empty_lists() {
    let db = db();
    db.execute("INSERT INTO tracks(id,path,title,music_dir) VALUES(1,'C:/Music/song.mp3','Song','c:/music')", []).unwrap();
    let local = track(1, "C:/Music/song.mp3");
    create(&db, "Empty after removal", None, &[local.clone()]).unwrap();
    create(
        &db,
        "Mixed",
        None,
        &[
            local,
            track(2, "C:/Music/sub/missing.mp3"),
            track(3, "C:/Music-other/keep.mp3"),
            track(4, "plugin://a/42"),
        ],
    )
    .unwrap();
    database::delete_tracks_for_music_dir(&db, std::path::Path::new("C:/MUSIC/")).unwrap();
    let lists = read_playlists(&db).unwrap();
    assert_eq!(lists.len(), 2);
    assert!(lists[0].tracks.is_empty());
    assert_eq!(lists[1].tracks.len(), 2);
    assert_eq!(lists[1].tracks[1].path, "plugin://a/42");
}

#[test]
fn validation_and_cover_updates() {
    let db = db();
    assert!(create(&db, "  ", None, &[]).is_err());
    let id = create(&db, "First", None, &[]).unwrap();
    assert!(create(&db, " First ", None, &[]).is_err());
    let other = create(&db, "Second", None, &[]).unwrap();
    assert!(rename(&db, &other, " First ").is_err());
    rename(&db, &id, " Renamed ").unwrap();
    update_cover(&db, &id, Some(" cover.png ")).unwrap();
    assert_eq!(
        read_playlists(&db).unwrap()[0].cover.as_deref(),
        Some("cover.png")
    );
    update_cover(&db, &id, None).unwrap();
    assert!(read_playlists(&db).unwrap()[0].cover.is_none());
    assert!(edit_tracks(&db, "missing", &[], true).is_err());
}

#[test]
fn failed_batch_rolls_back_creation_and_partial_membership() {
    let mut db = db();
    {
        let tx = db.transaction().unwrap();
        assert!(create(
            &tx,
            "Failed",
            None,
            &[track(1, "C:/valid.mp3"), track(2, "")]
        )
        .is_err());
    }
    assert!(read_playlists(&db).unwrap().is_empty());
}

#[test]
fn playlist_survives_reopening_database() {
    let path = std::env::temp_dir().join(format!("mono-playlists-{}.sqlite", uuid::Uuid::new_v4()));
    {
        let db = Connection::open(&path).unwrap();
        database::init_database(&db).unwrap();
        create(
            &db,
            "Saved",
            Some("cover.png"),
            &[track(1, "plugin://a/42")],
        )
        .unwrap();
    }
    {
        let db = Connection::open(&path).unwrap();
        database::init_database(&db).unwrap();
        let lists = read_playlists(&db).unwrap();
        assert_eq!(lists[0].name, "Saved");
        assert_eq!(lists[0].tracks[0].path, "plugin://a/42");
    }
    std::fs::remove_file(path).unwrap();
}
