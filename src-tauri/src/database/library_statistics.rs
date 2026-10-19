use crate::models::{artist_names, ArtistStatistics, FolderStatistics, LibraryStatistics, Track, TrackStatistics};
use rusqlite::Connection;


fn normalized_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches("//?/")
        .trim_end_matches('/')
        .to_lowercase()
}

use super::library_search::matches_query;

fn total_seconds(tracks: &[Track]) -> u64 {
    TrackStatistics::from_tracks(tracks).total_seconds
}

pub(crate) fn read(
    db: &Connection,
    directories: &[String],
    query: &str,
    unknown_artist: &str,
) -> Result<LibraryStatistics, String> {
    let tracks = super::read_tracks(db)?;
    let query = query.trim().to_lowercase();
    let mut rows = Vec::new();
    for (index, track) in tracks.iter().enumerate().filter(|(_, track)| matches_query(track, &query)) {
        let mut names = artist_names(track.artist.as_deref().unwrap_or(""));
        if names.is_empty() { names.push(unknown_artist.to_string()); }
        for name in names {
            rows.push(serde_json::json!({"name":name,"index":index,"title":track.title}));
        }
    }
    // Keep the existing artist splitting and search rules; SQLite determines both list orders.
    let mut statement = db.prepare("WITH entries AS (
        SELECT json_extract(value,'$.name') AS name,
               json_extract(value,'$.index') AS track_index,
               json_extract(value,'$.title') AS title FROM json_each(?1)
    ), ranked AS (SELECT *, COUNT(*) OVER (PARTITION BY name) AS track_count FROM entries)
    SELECT name, track_index FROM ranked
    ORDER BY track_count DESC, name COLLATE NOCASE, name, title COLLATE NOCASE, title, track_index")
        .map_err(|e| e.to_string())?;
    let ordered = statement.query_map([serde_json::to_string(&rows).map_err(|e| e.to_string())?], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, usize>(1)?))
    }).map_err(|e| e.to_string())?;
    let mut artists: Vec<ArtistStatistics> = Vec::new();
    for row in ordered {
        let (name, index) = row.map_err(|e| e.to_string())?;
        if artists.last().is_none_or(|group| group.name != name) {
            artists.push(ArtistStatistics { name, count: 0, total_seconds: 0, tracks: Vec::new() });
        }
        let group = artists.last_mut().unwrap();
        group.tracks.push(tracks[index].clone());
        group.count += 1;
    }
    for group in &mut artists { group.total_seconds = total_seconds(&group.tracks); }
    let mut folders = Vec::new();
    for path in directories {
        let prefix = format!("{}/", normalized_path(path));
        let folder_tracks: Vec<_> = tracks
            .iter()
            .filter(|track| normalized_path(&track.path).starts_with(&prefix))
            .cloned()
            .collect();
        if folder_tracks.is_empty() {
            continue;
        }
        let filtered_tracks: Vec<_> = folder_tracks
            .iter()
            .filter(|track| matches_query(track, &query))
            .cloned()
            .collect();
        let title = path
            .replace('\\', "/")
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or(path)
            .to_string();
        folders.push(FolderStatistics {
            path: path.clone(),
            title,
            count: folder_tracks.len(),
            total_seconds: total_seconds(&folder_tracks),
            tracks: folder_tracks,
            filtered_count: filtered_tracks.len(),
            filtered_total_seconds: total_seconds(&filtered_tracks),
            filtered_tracks,
        });
    }
    Ok(LibraryStatistics {
        artist_count: artists.len(),
        artist_track_count: artists.iter().map(|group| group.count).sum(),
        artists,
        folder_track_count: folders.iter().map(|folder| folder.count).sum(),
        folders,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn database() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        for (id, path, title, artist, duration) in [
            (1, "C:/Music/a.mp3", "Alpha", Some("甲 & 乙"), Some(60)),
            (2, "c:\\music\\sub\\b.mp3", "Beta", Some("甲"), Some(90)),
            (3, "C:/Music/c.mp3", "Gamma", None, None),
            (4, "C:/Music-other/d.mp3", "Delta", Some("丙"), Some(30)),
        ] {
            db.execute(
                "INSERT INTO tracks(id,path,title,artist,duration) VALUES(?1,?2,?3,?4,?5)",
                params![id, path, title, artist, duration],
            )
            .unwrap();
        }
        db
    }

    #[test]
    fn sql_orders_artists_by_count_then_name_and_tracks_by_title() {
        let db = database();
        db.execute("DELETE FROM tracks", []).unwrap();
        for (id, title, artist) in [(1,"Zulu","Beta"), (2,"alpha","Beta"), (3,"Second","alpha"), (4,"first","alpha"), (5,"Only","Aardvark")] {
            db.execute("INSERT INTO tracks(id,path,title,artist) VALUES(?1,?2,?3,?4)", params![id,format!("{id}.mp3"),title,artist]).unwrap();
        }
        let result = read(&db, &[], "", "Unknown").unwrap();
        assert_eq!(result.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>(), vec!["alpha","Beta","Aardvark"]);
        assert_eq!(result.artists[0].tracks.iter().map(|t| t.title.as_str()).collect::<Vec<_>>(), vec!["first","Second"]);
        assert_eq!(result.artists[1].tracks.iter().map(|t| t.title.as_str()).collect::<Vec<_>>(), vec!["alpha","Zulu"]);
    }

    #[test]
    fn groups_collaborations_and_unknown_artists_with_backend_totals() {
        let db = database();
        let result = read(&db, &[], "", "未知歌手").unwrap();
        let group = result
            .artists
            .iter()
            .find(|group| group.name == "甲")
            .unwrap();
        assert_eq!(group.count, 2);
        assert_eq!(group.total_seconds, 150);
        assert_eq!(result.artist_count, 4);
        assert_eq!(result.artist_track_count, 5);
        assert_eq!(
            result
                .artists
                .iter()
                .find(|g| g.name == "未知歌手")
                .unwrap()
                .total_seconds,
            0
        );
    }

    #[test]
    fn search_filters_artists_and_folder_contents_but_not_folder_totals() {
        let db = database();
        let result = read(
            &db,
            &[
                "C:\\MUSIC\\".into(),
                "C:/Music/sub".into(),
                "C:/Empty".into(),
            ],
            " ALPHA ",
            "Unknown artist",
        )
        .unwrap();
        assert_eq!(result.artist_count, 2);
        assert_eq!(result.folders.len(), 2);
        assert_eq!(result.folders[0].count, 3);
        assert_eq!(result.folders[0].total_seconds, 150);
        assert_eq!(result.folders[0].filtered_count, 1);
        assert_eq!(result.folders[0].filtered_total_seconds, 60);
        assert_eq!(result.folders[1].filtered_count, 0);
        assert_eq!(result.folder_track_count, 4);
        assert_eq!(
            read(&db, &[], "甲", "Unknown").unwrap().artist_track_count,
            3
        );
    }

    #[test]
    fn reflects_metadata_changes_and_removal_without_cached_totals() {
        let db = database();
        db.execute(
            "UPDATE tracks SET artist='新歌手',duration=120 WHERE id=1",
            [],
        )
        .unwrap();
        let result = read(&db, &["C:/Music".into()], "", "Unknown").unwrap();
        assert_eq!(result.folders[0].total_seconds, 210);
        assert_eq!(
            result
                .artists
                .iter()
                .find(|g| g.name == "新歌手")
                .unwrap()
                .count,
            1
        );
        db.execute("DELETE FROM tracks", []).unwrap();
        let empty = read(&db, &["C:/Music".into()], "", "Unknown").unwrap();
        assert_eq!(empty.artist_count, 0);
        assert_eq!(empty.folder_track_count, 0);
        assert!(empty.folders.is_empty());
    }
}
