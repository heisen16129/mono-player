use super::*;
use crate::models::{FavoriteList, Track};

#[test]
fn query_statistics_match_results_and_totals_stay_unfiltered() {
    let db = Connection::open_in_memory().unwrap();
    init_database(&db).unwrap();
    for id in 1..=105 {
        db.execute("INSERT INTO tracks(id,path,title,duration,added_at,scan_id,last_played_at)
            VALUES(?1,?2,?3,10,'2026-10-16 10:00:00','batch',?1)",
            params![id, format!("/{id}.mp3"), if id == 105 { "Match" } else { "Other" }]).unwrap();
    }
    let result = library_search::read(&db, "match").unwrap();
    assert_eq!(result.statistics.tracks.count, 1);
    assert_eq!(result.statistics.tracks.total_seconds, 10);
    assert_eq!(result.statistics.latest_added_tracks.total_seconds, 10);
    assert_eq!(result.statistics.recent_played_tracks.total_seconds, 10);
    assert_eq!(result.totals.tracks.count, 105);
    assert_eq!(result.totals.tracks.total_seconds, 1050);
    assert_eq!(result.totals.recent_played_tracks.count, 100);
    assert_eq!(result.totals.recent_played_tracks.total_seconds, 1000);
    let empty = library_search::read(&db, "missing").unwrap();
    assert_eq!(empty.statistics.tracks.count, 0);
    assert_eq!(empty.statistics.tracks.total_seconds, 0);
}

#[test]
fn favorites_and_playlists_include_online_and_unknown_durations_and_refresh_metadata() {
    let db = Connection::open_in_memory().unwrap();
    init_database(&db).unwrap();
    db.execute("INSERT INTO tracks(id,path,title,duration) VALUES(1,'C:/Music/a.mp3','Local',60)", []).unwrap();
    let local = read_tracks(&db).unwrap().remove(0);
    let online: Track = serde_json::from_value(serde_json::json!({
        "id": -1, "path": "plugin://provider/song", "title": "Online", "duration": 90,
        "sourceProviderId": "provider", "sourceId": "song"
    })).unwrap();
    let unknown: Track = serde_json::from_value(serde_json::json!({
        "id": -2, "path": "https://example.test/song", "title": "Unknown"
    })).unwrap();
    for track in [&local, &online, &unknown] { favorites::insert_favorite(&db, track).unwrap(); }
    let id = playlists::create(&db, "Mixed", None, &[local, online, unknown]).unwrap();
    let favorite = FavoriteList::from(favorites::read_favorites(&db).unwrap());
    let list = playlists::read_playlists(&db).unwrap().remove(0);
    assert_eq!(favorite.statistics.count, 3);
    assert_eq!(favorite.statistics.total_seconds, 150);
    assert_eq!(list.statistics.count, 3);
    assert_eq!(list.statistics.total_seconds, 150);
    db.execute("UPDATE tracks SET duration=120 WHERE id=1", []).unwrap();
    assert_eq!(FavoriteList::from(favorites::read_favorites(&db).unwrap()).statistics.total_seconds, 210);
    assert_eq!(playlists::read_playlists(&db).unwrap()[0].statistics.total_seconds, 210);
    playlists::edit_tracks(&db, &id, &list.tracks, false).unwrap();
    assert_eq!(playlists::read_playlists(&db).unwrap()[0].statistics.count, 0);
    assert_eq!(playlists::read_playlists(&db).unwrap()[0].statistics.total_seconds, 0);
}
