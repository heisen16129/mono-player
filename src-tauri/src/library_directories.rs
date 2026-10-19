use crate::{api_response::ApiResponse, database::{self, library_directories as repo}, models::library_directories::DirectorySnapshot, state::AppState};
use serde_json::{json, Map, Value};
use std::{collections::HashSet, path::Path};
use tauri::{AppHandle, Emitter, Manager};

fn directory_key(path: &str) -> String {
    database::normalized_track_path(path).trim_end_matches('/').to_owned()
}

pub(crate) fn normalize(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for path in paths {
        let raw = path.trim();
        if raw.is_empty() { continue; }
        let path = if raw.to_ascii_lowercase().starts_with("file:") {
            tauri::Url::parse(raw).map_err(|e| e.to_string())?.to_file_path().map_err(|_| "无效的目录地址")?.to_string_lossy().into_owned()
        } else { raw.to_owned() };
        if !Path::new(&path).is_absolute() || path.contains('\0') { return Err(format!("曲库目录必须是绝对路径：{path}")); }
        let mut clean = std::path::PathBuf::new();
        for part in Path::new(&path).components() {
            match part { std::path::Component::CurDir => {}, std::path::Component::ParentDir => { clean.pop(); }, other => clean.push(other.as_os_str()) }
        }
        let path = clean.to_string_lossy().into_owned();
        if seen.insert(directory_key(&path)) { result.push(path); }
    }
    Ok(result)
}

fn legacy(settings: &Value) -> Vec<String> {
    let value = crate::settings::normalize(settings.clone());
    value["musicDirs"].as_array().into_iter().flatten().filter_map(Value::as_str).map(str::to_owned).collect()
}

pub(crate) fn apply_settings(app: &AppHandle, values: &Map<String, Value>, settings: &mut Value) -> Result<(), String> {
    let state = app.state::<AppState>();
    let db = state.db.lock().map_err(|e| e.to_string())?;
    apply_stored_directories(&db, values, settings)
}

fn apply_stored_directories(db: &rusqlite::Connection, values: &Map<String, Value>, settings: &mut Value) -> Result<(), String> {
    let dirs = repo::read(db)?.unwrap_or_else(|| legacy(values.get(crate::settings::KEY).unwrap_or(&Value::Null)));
    settings["musicDir"] = json!(dirs.first().cloned().unwrap_or_default());
    settings["musicDirs"] = json!(dirs);
    Ok(())
}

fn update(app: &AppHandle, paths: Vec<String>, append: bool) -> Result<DirectorySnapshot, String> {
    let paths = normalize(paths)?;
    let stored = crate::store::read_values(app)?;
    let state = app.state::<AppState>();
    let (snapshot, removed_sources) = {
        let mut db = state.db.lock().map_err(|e| e.to_string())?;
        let previous = repo::read(&db)?.unwrap_or_else(|| legacy(stored.get(crate::settings::KEY).unwrap_or(&Value::Null)));
        let next = if append { normalize(previous.iter().cloned().chain(paths).collect())? } else { paths };
        let old_keys: HashSet<_> = previous.iter().map(|p| directory_key(p)).collect();
        for path in &next {
            if !old_keys.contains(&directory_key(path)) && !Path::new(path).is_dir() { return Err(format!("目录不存在或不是文件夹：{path}")); }
        }
        let keys: HashSet<_> = next.iter().map(|p| directory_key(p)).collect();
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let mut removed = Vec::new();
        for path in previous.iter().filter(|p| !keys.contains(&directory_key(p))) {
            removed.extend(database::delete_tracks_for_music_dir_in_transaction(&tx, Path::new(path))?);
        }
        repo::save(&tx, &next)?;
        let tracks = database::read_tracks(&tx)?;
        let snapshot = DirectorySnapshot { music_dir: next.first().cloned().unwrap_or_default(), music_dirs: next, statistics: crate::models::TrackStatistics::from_tracks(&tracks), tracks, latest_added_tracks: database::read_latest_added_tracks(&tx)? };
        tx.commit().map_err(|e| e.to_string())?;
        (snapshot, removed)
    };
    crate::player::remove_library_queue_sources(app, removed_sources)?;
    let _ = app.emit("library-directories-changed", &snapshot.music_dirs);
    let _ = app.emit("favorites-changed", ());
    let _ = app.emit("playlists-changed", ());
    Ok(snapshot)
}

pub(crate) fn register_scan_paths(app: &AppHandle, paths: Vec<String>) -> Result<DirectorySnapshot, String> { update(app, paths, true) }

#[tauri::command]
pub(crate) async fn update_library_directories(app: AppHandle, paths: Vec<String>) -> ApiResponse<DirectorySnapshot> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let scans = app.state::<crate::scanner::batch::ScanBatchState>();
        scans.with_idle(|| update(&app, paths, false))
    }).await.map_err(|e| e.to_string()).and_then(|r| r);
    ApiResponse::from_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stale_settings_cannot_restore_removed_directories() {
        let db = rusqlite::Connection::open_in_memory().unwrap();
        repo::init_table(&db).unwrap();
        let values = json!({"mono-player-settings":{"musicDir":"D:/Old","musicDirs":["D:/Old"]}}).as_object().unwrap().clone();
        let mut settings = json!({"musicDirs":["D:/Stale"],"musicDir":"D:/Stale","volume":0.5});
        apply_stored_directories(&db,&values,&mut settings).unwrap();
        assert_eq!(settings["musicDirs"],json!(["D:/Old"]));
        repo::save(&db,&[]).unwrap();
        apply_stored_directories(&db,&values,&mut settings).unwrap();
        assert_eq!(settings["musicDirs"],json!([]));
        assert_eq!(settings["musicDir"],"");
        assert_eq!(settings["volume"],0.5);
    }
    #[test]
    #[cfg(windows)]
    fn paths_are_normalized_without_requiring_existing_offline_directories() {
        let paths = normalize(vec![" D:/Music/ ".into(), "d:\\music".into(), "file:///D:/Music".into(), "D:/Other/../Music".into(), "".into()]).unwrap();
        assert_eq!(paths.len(),1);
        assert_eq!(directory_key(&paths[0]),"d:/music");
        assert!(normalize(vec!["relative/music".into()]).is_err());
        assert!(normalize(vec!["https://example.com/music".into()]).is_err());
    }
}
