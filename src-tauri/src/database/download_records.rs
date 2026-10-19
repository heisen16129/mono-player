use crate::{downloads::DownloadQueueEvent, models::download_record::DownloadRecord};
use rusqlite::{Connection, OptionalExtension, params};

pub(crate) fn init_table(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS download_records (
        id TEXT PRIMARY KEY, run_id TEXT UNIQUE, created_at INTEGER NOT NULL, payload TEXT NOT NULL
    );")
}
pub(crate) fn list(db: &Connection) -> Result<Vec<DownloadRecord>, String> {
    let mut stmt = db.prepare("SELECT payload FROM download_records ORDER BY created_at DESC, rowid DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| r.get::<_,String>(0)).map_err(|e| e.to_string())?;
    rows.map(|r| serde_json::from_str(&r.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}
pub(crate) fn list_category(db: &Connection, category: &str) -> Result<Vec<DownloadRecord>, String> {
    let predicate = match category {
        "downloaded" => "json_extract(payload,'$.status') = 'downloaded'",
        "downloading" => "json_extract(payload,'$.status') IN ('downloading','paused','failed')",
        _ => return Err("无效的下载分类".into()),
    };
    let mut statement = db.prepare(&format!("SELECT payload FROM download_records WHERE {predicate} ORDER BY created_at DESC, rowid DESC")).map_err(|e| e.to_string())?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())).collect()
}

pub(crate) fn get(db: &Connection, id: &str) -> Result<Option<(DownloadRecord, Option<String>)>, String> {
    let row = db.query_row("SELECT payload,run_id FROM download_records WHERE id=?1", [id], |r| Ok((r.get::<_,String>(0)?, r.get::<_,Option<String>>(1)?))).optional().map_err(|e| e.to_string())?;
    row.map(|(payload, run)| serde_json::from_str(&payload).map(|item| (item,run)).map_err(|e| e.to_string())).transpose()
}
pub(crate) fn save(db: &Connection, item: &DownloadRecord, run: Option<&str>) -> Result<(), String> {
    let payload = serde_json::to_string(item).map_err(|e| e.to_string())?;
    db.execute("INSERT INTO download_records(id,run_id,created_at,payload) VALUES(?1,?2,?3,?4)
        ON CONFLICT(id) DO UPDATE SET run_id=excluded.run_id,created_at=excluded.created_at,payload=excluded.payload",
        params![item.id,run,item.created_at,payload]).map(|_| ()).map_err(|e| e.to_string())
}
pub(crate) fn remove(db: &Connection, id: &str) -> Result<(), String> {
    db.execute("DELETE FROM download_records WHERE id=?1", [id]).map(|_| ()).map_err(|e| e.to_string())
}
pub(crate) fn apply_event(db: &Connection, event: &DownloadQueueEvent) -> Result<Option<DownloadRecord>, String> {
    let id: Option<String> = db.query_row("SELECT id FROM download_records WHERE run_id=?1", [&event.task_id], |r| r.get(0)).optional().map_err(|e| e.to_string())?;
    let Some(id) = id else { return Ok(None); };
    let Some((mut item, run)) = get(db, &id)? else { return Ok(None); };
    if item.status == "paused" && event.status == "downloading" { return Ok(None); }
    if !matches!(item.status.as_str(), "paused" | "downloading") { return Ok(None); }
    item.status = event.status.clone();
    item.progress = event.progress;
    item.error = event.error.clone();
    if event.status == "downloaded" {
        item.file_path = event.file_path.clone(); item.lyrics_path = event.lyrics_path.clone();
    }
    let terminal = event.status == "downloaded" || event.status == "failed";
    save(db, &item, if terminal { None } else { run.as_deref() })?;
    Ok(Some(item))
}
pub(crate) fn recover_interrupted(db: &Connection) -> Result<(), String> {
    for mut item in list(db)? {
        if item.status == "downloading" {
            item.status = "failed".into(); item.error = Some("下载已中断".into());
        }
        save(db, &item, None)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn record() -> DownloadRecord {
        serde_json::from_value(serde_json::json!({"id":"provider:1","title":"Song","artist":["Artist"],"duration":123.5,"sourceName":"provider","sourceId":"1","status":"downloading","progress":0,"createdAt":1})).unwrap()
    }
    fn event(run: &str, status: &str) -> DownloadQueueEvent {
        DownloadQueueEvent { task_id: run.into(), status: status.into(), progress: 100, file_path: Some("song.mp3".into()), lyrics_path: None, error: None }
    }
    #[test]
    fn categories_only_return_matching_statuses_and_follow_changes() {
        let db = Connection::open_in_memory().unwrap(); init_table(&db).unwrap();
        for (index, status) in ["downloaded", "downloading", "paused", "failed"].iter().enumerate() {
            let mut item = record(); item.id = status.to_string(); item.status = status.to_string(); item.created_at = index as i64;
            save(&db, &item, None).unwrap();
        }
        assert_eq!(list_category(&db,"downloaded").unwrap().len(),1);
        assert_eq!(list_category(&db,"downloading").unwrap().iter().map(|i| i.status.as_str()).collect::<Vec<_>>(), vec!["failed","paused","downloading"]);
        let (mut item, _) = get(&db,"downloading").unwrap().unwrap();
        item.status = "downloaded".into(); save(&db,&item,None).unwrap();
        assert_eq!(list_category(&db,"downloaded").unwrap().len(),2);
        assert_eq!(list_category(&db,"downloading").unwrap().len(),2);
        assert!(list_category(&db,"all").is_err());
    }

    #[test]
    fn stale_download_events_cannot_overwrite_retry_or_restore_removed_records() {
        let db = Connection::open_in_memory().unwrap(); init_table(&db).unwrap();
        let item = record();
        save(&db, &item, Some("old")).unwrap(); save(&db, &item, Some("new")).unwrap();
        assert!(apply_event(&db, &event("old", "downloaded")).unwrap().is_none());
        let done = apply_event(&db, &event("new", "downloaded")).unwrap().unwrap();
        assert_eq!(done.file_path.as_deref(), Some("song.mp3"));
        remove(&db, &item.id).unwrap();
        assert!(apply_event(&db, &event("new", "downloaded")).unwrap().is_none());
        assert!(list(&db).unwrap().is_empty());
    }
    #[test]
    fn download_recovery_preserves_paused_and_completed_records() {
        let db = Connection::open_in_memory().unwrap(); init_table(&db).unwrap();
        for status in ["downloading", "paused", "downloaded"] {
            let mut item = record(); item.id = status.into(); item.status = status.into();
            save(&db, &item, Some(status)).unwrap();
        }
        recover_interrupted(&db).unwrap();
        for status in ["downloading", "paused", "downloaded"] {
            let (item, run) = get(&db, status).unwrap().unwrap();
            assert!(run.is_none());
            assert_eq!(item.status, if status == "downloading" { "failed" } else { status });
        }
    }
    #[test]
    fn paused_download_ignores_progress_but_accepts_completion() {
        let db = Connection::open_in_memory().unwrap(); init_table(&db).unwrap();
        let mut item = record(); item.status = "paused".into();
        save(&db, &item, Some("run")).unwrap();
        assert!(apply_event(&db, &event("run", "downloading")).unwrap().is_none());
        assert_eq!(apply_event(&db, &event("run", "downloaded")).unwrap().unwrap().status, "downloaded");
    }
}
