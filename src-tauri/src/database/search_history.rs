use rusqlite::Connection;

pub(crate) fn init_table(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL UNIQUE
    );",
    )
}

fn valid_keyword(keyword: &str) -> Option<&str> {
    let keyword = keyword.trim();
    (!keyword.is_empty() && !matches!(keyword, "热门歌曲" | "热门歌手")).then_some(keyword)
}

pub(crate) fn update(
    db: &Connection,
    action: &str,
    keyword: &str,
    limit: u32,
) -> Result<Vec<String>, String> {
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    match action {
        "record" => {
            if let Some(keyword) = valid_keyword(keyword) {
                tx.execute("DELETE FROM search_history WHERE keyword=?1", [keyword])
                    .map_err(|e| e.to_string())?;
                tx.execute("INSERT INTO search_history(keyword) VALUES(?1)", [keyword])
                    .map_err(|e| e.to_string())?;
            }
        }
        "remove" => {
            tx.execute(
                "DELETE FROM search_history WHERE keyword=?1",
                [keyword.trim()],
            )
            .map_err(|e| e.to_string())?;
        }
        "clear" => {
            tx.execute("DELETE FROM search_history", [])
                .map_err(|e| e.to_string())?;
        }
        "list" => {}
        _ => return Err("Unknown search history action".into()),
    }
    tx.execute(
        "DELETE FROM search_history WHERE id NOT IN (
        SELECT id FROM search_history ORDER BY id DESC LIMIT ?1
    )",
        [limit.clamp(1, 25)],
    )
    .map_err(|e| e.to_string())?;
    let history = {
        let mut stmt = tx
            .prepare("SELECT keyword FROM search_history ORDER BY id DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<Vec<String>>>()
            .map_err(|e| e.to_string())?
    };
    tx.commit().map_err(|e| e.to_string())?;
    Ok(history)
}

pub(crate) fn import_legacy(db: &Connection, history: &[String]) -> Result<(), String> {
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    let count: i64 = tx
        .query_row("SELECT COUNT(*) FROM search_history", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if count == 0 {
        let mut keywords = Vec::new();
        for item in history {
            if let Some(keyword) = valid_keyword(item) {
                if !keywords.contains(&keyword) {
                    keywords.push(keyword);
                }
            }
        }
        for keyword in keywords.into_iter().take(25).rev() {
            tx.execute("INSERT INTO search_history(keyword) VALUES(?1)", [keyword])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deduplicates_orders_excludes_and_trims_history() {
        let db = Connection::open_in_memory().unwrap();
        init_table(&db).unwrap();
        for keyword in ["甲", "乙", " 甲 ", "热门歌曲", "热门歌手", " "] {
            update(&db, "record", keyword, 25).unwrap();
        }
        assert_eq!(update(&db, "list", "", 25).unwrap(), vec!["甲", "乙"]);
        assert_eq!(update(&db, "list", "", 1).unwrap(), vec!["甲"]);
        assert_eq!(update(&db, "list", "", 25).unwrap(), vec!["甲"]);
        assert!(update(&db, "remove", " 甲 ", 25).unwrap().is_empty());
        update(&db, "record", "新", 25).unwrap();
        assert!(update(&db, "clear", "", 25).unwrap().is_empty());
    }
    #[test]
    fn migration_keeps_latest_order_and_does_not_overwrite_database() {
        let db = Connection::open_in_memory().unwrap();
        init_table(&db).unwrap();
        import_legacy(
            &db,
            &[" 新 ".into(), "旧".into(), "新".into(), "热门歌曲".into()],
        )
        .unwrap();
        assert_eq!(update(&db, "list", "", 25).unwrap(), vec!["新", "旧"]);
        import_legacy(&db, &["不覆盖".into()]).unwrap();
        assert_eq!(update(&db, "list", "", 25).unwrap(), vec!["新", "旧"]);
    }
}
