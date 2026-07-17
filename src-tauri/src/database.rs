use crate::models::Track;
use crate::state::AppState;
use crate::api_response::ApiResponse;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::Accessor;
use lofty::tag::{ItemKey, Tag};
use rodio::{Decoder, Source};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::fs::File;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Deserialize)]
pub(crate) struct UpdateTrackMetadataRequest {
    pub(crate) id: i64,
    pub(crate) path: String,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) year: Option<u32>,
    pub(crate) genre: Option<String>,
    #[serde(rename = "trackNumber")]
    pub(crate) track_number: Option<u32>,
}

#[derive(Debug, Serialize)]
pub(crate) struct UpdateTrackMetadataResult {
    pub(crate) id: i64,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) year: Option<u32>,
    pub(crate) genre: Option<String>,
    #[serde(rename = "trackNumber")]
    pub(crate) track_number: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct UpdateTrackCoverRequest {
    pub(crate) path: String,
    #[serde(rename = "coverPath")]
    pub(crate) cover_path: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RefreshTrackDurationRequest {
    pub(crate) id: i64,
    pub(crate) path: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct RefreshTrackDurationResult {
    pub(crate) id: i64,
    pub(crate) duration: u64,
}

/**
 * 閸戣姤鏆熼幒銉︽暪娑撯偓娑?State 閸欍儲鐒洪敍宀€鏁ゆ禍搴ゎ問闂傤喖瀵橀崥顐ｆ殶閹诡喖绨辨潻鐐村复閻ㄥ嫬绨查悽銊ュ彙娴滎偆濮搁幀? */
//鏉╂瑤閲滅€瑰繐鐨㈢拠銉ュ毐閺佺増姣氶棁鑼舶閸撳秶顏?#[tauri::command]
#[allow(unused_doc_comments)]
#[tauri::command]
pub(crate) fn list_tracks(state: State<'_, AppState>) -> ApiResponse<Vec<Track>> {
    eprintln!("[library:list_tracks] request");
    //  /瑜版挷缍橀崷銊ょ娑擃亣绻戦崶?Result 閻ㄥ嫬鍤遍弫棰佽厬娴ｈ法鏁?? 閺冭绱濈€瑰啰娈戦柅鏄忕帆缁涘鐜禍搴濅簰娑?match 鐞涖劏鎻蹇ョ窗
    //  let db = match state.db.lock().map_err(|err| err.to_string()) {
    //     Ok(value) => value, // 婵″倹鐏夐幋鎰閿涘矁袙閸栧懎鍤崐纭风礉缂佈呯敾閹笛嗩攽娑撳绔寸悰?    //     Err(error) => return Err(error), // 婵″倹鐏夋径杈Е閿涘矁鍤滈崝銊ょ矤瑜版挸澧犻崙鑺ユ殶鏉╂柨娲?Err!  楠炲爼娈ｅ蹇撴勾 return Err(...)閵?    //     };

    //     娑撯偓缁夊秷顕㈠▔鏇犵「閿涘湯yntactic Sugar閿涘绱濈€瑰啰娈戠拋鎹愵吀閸掓繆銆嬬亸杈ㄦЦ娑撹桨绨＄拋鈺€缍樼亸鎴濆晸閺嶉攱婢樻禒锝囩垳閿涘湐oilerplate閿涘鈧倸鐣犻幎濞锯偓婊勵梾閺屻儵鏁婄拠顖椻偓婵嗘嫲閳ユ粏绻戦崶鐐烘晩鐠囶垪鈧繆绻栨稉銈勯嚋閸斻劋缍旈崥鍫濊嫙閹存劒绨℃稉鈧稉顏勭摟缁楋负鈧?
    let db = match state.db.lock().map_err(|err| err.to_string()) {
        Ok(db) => db,
        Err(error) => return ApiResponse::error(error),
    };
    match read_tracks(&db) {
        Ok(tracks) => {
            eprintln!("[library:list_tracks] response count={}", tracks.len());
            ApiResponse::success(tracks)
        }
        Err(error) => {
            eprintln!("[library:list_tracks] error={error}");
            ApiResponse::error(error)
        }
    }
}

#[tauri::command]
pub(crate) fn list_latest_added_tracks(state: State<'_, AppState>) -> ApiResponse<Vec<Track>> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|err| err.to_string())?;
        read_latest_added_tracks(&db)
    })())
}

#[tauri::command]
pub(crate) fn remove_music_dir(
    state: State<'_, AppState>,
    path: String,
) -> ApiResponse<Vec<Track>> {
    ApiResponse::from_result((|| {
        let root = PathBuf::from(path.trim());
        let db = state.db.lock().map_err(|err| err.to_string())?;
        delete_tracks_for_dir(&db, &root)?;
        read_tracks(&db)
    })())
}

#[tauri::command]
pub(crate) fn update_track_metadata(
    state: State<'_, AppState>,
    request: UpdateTrackMetadataRequest,
) -> ApiResponse<UpdateTrackMetadataResult> {
    ApiResponse::from_result((|| {
        let title = normalize_required_text(request.title, "歌曲名称不能为空。")?;
        let artist = normalize_optional_text(request.artist);
        let album = normalize_optional_text(request.album);
        let genre = normalize_optional_text(request.genre);
        let year = request.year.filter(|value| (1000..=9999).contains(value));
        let track_number = request.track_number.filter(|value| *value > 0);
        write_track_file_metadata(
            &request.path,
            &title,
            artist.as_deref(),
            album.as_deref(),
            year,
            genre.as_deref(),
            track_number,
        )?;

        let db = state.db.lock().map_err(|err| err.to_string())?;
        let changed = db
            .execute(
                "UPDATE tracks
                 SET title = ?1, artist = ?2, album = ?3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?4 OR path = ?5",
                params![title, artist, album, request.id, request.path],
            )
            .map_err(|err| err.to_string())?;

        if changed == 0 {
            return Err("没有找到要更新的歌曲。".to_string());
        }

        Ok(UpdateTrackMetadataResult {
            id: request.id,
            title,
            artist,
            album,
            year,
            genre,
            track_number,
        })
    })())
}

#[tauri::command]
pub(crate) fn update_track_cover(request: UpdateTrackCoverRequest) -> ApiResponse<()> {
    ApiResponse::from_empty_result(write_track_cover_metadata(&request.path, &request.cover_path))
}

#[tauri::command]
pub(crate) fn refresh_track_duration(
    state: State<'_, AppState>,
    request: RefreshTrackDurationRequest,
) -> ApiResponse<RefreshTrackDurationResult> {
    ApiResponse::from_result(refresh_track_duration_inner(state, request))
}

fn refresh_track_duration_inner(
    state: State<'_, AppState>,
    request: RefreshTrackDurationRequest,
) -> Result<RefreshTrackDurationResult, String> {
    let path = PathBuf::from(request.path.trim());
    if !path.is_file() {
        return Err("歌曲文件不存在。".to_string());
    }

    let duration = read_track_duration_seconds(&path)?;
    if duration == 0 {
        return Err("没有读取到有效的歌曲时长。".to_string());
    }

    let db = state.db.lock().map_err(|err| err.to_string())?;
    let changed = db
        .execute(
            "UPDATE tracks
             SET duration = ?1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2 OR path = ?3",
            params![duration, request.id, path.to_string_lossy().to_string()],
        )
        .map_err(|err| err.to_string())?;

    if changed == 0 {
        return Err("没有找到要更新的歌曲。".to_string());
    }

    Ok(RefreshTrackDurationResult {
        id: request.id,
        duration,
    })
}

fn read_track_duration_seconds(path: &Path) -> Result<u64, String> {
    let file = File::open(path).map_err(|err| err.to_string())?;
    let decoder = Decoder::try_from(file).map_err(|err| {
        format!("读取失败：音频文件格式异常或包含损坏帧，无法读取时长。{err}")
    })?;

    decoder
        .total_duration()
        .map(|duration| duration.as_secs())
        .filter(|duration| *duration > 0)
        .ok_or_else(|| "没有读取到有效的歌曲时长。".to_string())
}

/**
* id INTEGER PRIMARY KEY AUTOINCREMENT閿涙艾鐣炬稊澶夊瘜闁?id閿涘瞼琚崹瀣╄礋閺佸瓨鏆熼敍灞肩瑬閼奉亜濮╅柅鎺戭杻閵?   path TEXT NOT NULL UNIQUE閿涙艾鐡ㄩ崒銊╃叾娑旀劖鏋冩禒鍓佹畱鐠侯垰绶為妴渚糘T NULL 鐞涖劎銇氭稉宥堝厴娑撹櫣鈹栭敍瀛禢IQUE 鐞涖劎銇氱捄顖氱窞韫囧懘銆忛崬顖欑閿涘牓妲诲銏ゅ櫢婢跺秴缍嶉崗銉ユ倱娑撯偓妫ｆ牗鐡曢敍澶堚偓?   title TEXT NOT NULL閿涙艾鐡ㄩ崒銊︾摃閺囧弶鐖ｆ０姗堢礉娑撳秷鍏樻稉铏光敄閵?   artist TEXT閿涙艾鐡ㄩ崒銊ㄥ閺堫垰顔嶉崥宥囆為敍灞藉帒鐠侀晲璐熺粚鐚寸礄NULL閿涘鈧?   album TEXT閿涙艾鐡ㄩ崒銊ょ瑩鏉堟垵鎮曠粔甯礉閸忎浇顔忔稉铏光敄閵?   duration INTEGER閿涙艾鐡ㄩ崒銊︾摃閺囧弶妞傞梹鍖＄礄缁夋帪绱氶敍灞藉帒鐠侀晲璐熺粚鎭掆偓?   updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP閿涙俺顔囪ぐ鏇熸付閸氬孩娲块弬鐗堟闂傝揪绱濇妯款吇娑撳搫缍嬮崜宥嗘闂傚瓨鍩戦妴?*/
pub(crate) fn init_database(db: &Connection) -> rusqlite::Result<()> {
    db.execute(
        "CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,  
            title TEXT NOT NULL,
            artist TEXT,
            album TEXT,
            duration INTEGER,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            scan_id TEXT
        )",
        [],
    )?; //閸掓稑缂?tracks 鐞??  ? 閺冭绱濈€瑰啰娈戦柅鏄忕帆缁涘鐜禍搴濅簰娑?match 鐞涖劏鎻蹇ョ窗
    ensure_track_column(db, "added_at", "TEXT")?;
    ensure_track_column(db, "scan_id", "TEXT")?;
    db.execute(
        "UPDATE tracks SET added_at = COALESCE(added_at, updated_at, CURRENT_TIMESTAMP)",
        [],
    )?;
    Ok(())
}

fn ensure_track_column(db: &Connection, name: &str, definition: &str) -> rusqlite::Result<()> {
    let mut statement = db.prepare("PRAGMA table_info(tracks)")?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    if columns.iter().any(|column| column == name) {
        return Ok(());
    }

    db.execute(
        &format!("ALTER TABLE tracks ADD COLUMN {name} {definition}"),
        [],
    )?;
    Ok(())
}

/**
 * 閸戣姤鏆熼幒銉︽暪娑撯偓娑擃亝鏆熼幑顔肩氨鏉╃偞甯寸€电钖?db閿涘苯鑻熸潻鏂挎礀娑撯偓娑擃亜瀵橀崥顐ｅ閺堝娲搁惄顔煎灙鐞涖劎娈?Vec<Track>閵? * 閸戣姤鏆熸＃鏍у帥閸掓稑缂撴稉鈧稉?SQL 閺屻儴顕楃拠顓炲綖閿涘瞼鏁ゆ禍搴濈矤 tracks 鐞涖劋鑵戠拠璇插絿閹碘偓閺堝鏆熼幑顔衡偓? * 閻掕泛鎮楅敍灞煎▏閻?query_map 閺傝纭堕幍褑顢戦弻銉嚄閿涘苯鑻熸担璺ㄦ暏 map_err 婢跺嫮鎮婇柨娆掝嚖閵? * query_map 閺傝纭舵潻鏂挎礀娑撯偓娑?Result<Rows, Error>閿涘苯鍙炬稉?Rows 閺勵垯绔存稉顏囧嚡娴狅絽娅掗敍宀€鏁ゆ禍搴ㄤ憾閸樺棙鐓＄拠銏㈢波閺嬫嚎鈧? * 闁秴宸?Rows閿涘苯鐨㈠В蹇庣鐞涘本妲х亸鍕礋 Track 缂佹挻鐎担鎿勭礉楠炴儼绻戦崶鐐扮娑擃亜瀵橀崥顐ｅ閺?Track
 */
pub(crate) fn read_tracks(db: &Connection) -> Result<Vec<Track>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id, path, title, artist, album, duration, added_at, scan_id
             FROM tracks
             ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration: row.get(5)?,
                added_at: row.get(6)?,
                scan_id: row.get(7)?,
                lyrics: None,
            })
        })
        .map_err(|err| err.to_string())?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map(enrich_tracks_with_local_lyrics)
        .map_err(|err| err.to_string())
}

/**
 * 閸戣姤鏆熼幒銉︽暪娑撯偓娑擃亝鏆熼幑顔肩氨鏉╃偞甯寸€电钖?db 閸滃奔绔存稉?Track 缂佹挻鐎担鎾村瘹闁?track閿涘苯鑻熸潻鏂挎礀娑撯偓娑?Result<(), String>閵? * 閸戣姤鏆熸＃鏍у帥閸掓稑缂撴稉鈧稉?SQL 閹绘帒鍙嗙拠顓炲綖閿涘瞼鏁ゆ禍搴＄殺 Track 缂佹挻鐎担鎾存殶閹诡喗褰冮崗?tracks 鐞涖劋鑵戦妴? * 閻掕泛鎮楅敍灞煎▏閻?execute 閺傝纭堕幍褑顢戦幓鎺戝弳鐠囶厼褰為敍灞借嫙娴ｈ法鏁?map_err 婢跺嫮鎮婇柨娆掝嚖閵? * execute 閺傝纭舵潻鏂挎礀娑撯偓娑?Result<usize, Error>閿涘苯鍙炬稉?usize 鐞涖劎銇氶崣妤€濂栭崫宥囨畱鐞涘本鏆熼妴? * 婵″倹鐏夐崣妤€濂栭崫宥囨畱鐞涘本鏆熺粵澶夌艾 0閿涘苯鍨拠瀛樻閹绘帒鍙嗘径杈Е閿涘矁绻戦崶鐐扮娑擃亪鏁婄拠顖欎繆閹垬鈧? */
pub(crate) fn read_latest_added_tracks(db: &Connection) -> Result<Vec<Track>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id, path, title, artist, album, duration, added_at, scan_id
             FROM tracks
             WHERE scan_id IN (
                SELECT DISTINCT scan_id
                FROM tracks
                WHERE scan_id IS NOT NULL
                  AND scan_id <> ''
                  AND date(added_at) = (
                    SELECT date(MAX(added_at))
                    FROM tracks
                    WHERE scan_id IS NOT NULL AND scan_id <> ''
                  )
             )
             ORDER BY added_at DESC, id DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Track {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration: row.get(5)?,
                added_at: row.get(6)?,
                scan_id: row.get(7)?,
                lyrics: None,
            })
        })
        .map_err(|err| err.to_string())?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map(enrich_tracks_with_local_lyrics)
        .map_err(|err| err.to_string())
}

fn enrich_tracks_with_local_lyrics(mut tracks: Vec<Track>) -> Vec<Track> {
    for track in &mut tracks {
        track.lyrics = crate::lyrics::read_local_lyrics_bundle_for_track(
            &track.path,
            Some(&track.title),
            track.artist.as_deref(),
            None,
        )
        .ok()
        .flatten();
    }
    tracks
}

pub(crate) fn upsert_track(
    db: &Connection,
    track: &Track,
    scan_id: Option<&str>,
) -> Result<(), String> {
    let existing_path = match find_existing_track_path(db, &track.path)? {
        Some(path) => Some(path),
        None => find_existing_track_path_by_file_traits(db, track)?,
    };
    if let Some(existing_path) = existing_path {
        let existing_added_at = read_track_added_at(db, &existing_path)?;
        if let Some(scan_id) = scan_id {
            eprintln!(
                "[scanner-db] scan_id={} action=update addedAt={} existing_path={} new_path={} title={} artist={} duration={:?}",
                scan_id,
                existing_added_at.as_deref().unwrap_or(""),
                existing_path,
                track.path,
                track.title,
                track.artist.as_deref().unwrap_or(""),
                track.duration
            );
        }
        db.execute(
            "UPDATE tracks
             SET path = ?1, title = ?2, artist = ?3, album = ?4, duration = ?5, updated_at = CURRENT_TIMESTAMP
             WHERE path = ?6",
            params![
                track.path,
                track.title,
                track.artist,
                track.album,
                track.duration,
                existing_path,
            ],
        )
        .map_err(|err| err.to_string())?;
        return Ok(());
    }

    let added_at = current_sqlite_timestamp();
    if let Some(scan_id) = scan_id {
        eprintln!(
            "[scanner-db] scan_id={} action=insert addedAt={} path={} title={} artist={} duration={:?}",
            scan_id,
            added_at,
            track.path,
            track.title,
            track.artist.as_deref().unwrap_or(""),
            track.duration
        );
    }
    db.execute(
        "INSERT INTO tracks (path, title, artist, album, duration, updated_at, added_at, scan_id)
         VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, ?6, ?7)
         ON CONFLICT(path) DO UPDATE SET
            title = excluded.title,
            artist = excluded.artist,
            album = excluded.album,
            duration = excluded.duration,
            updated_at = CURRENT_TIMESTAMP",
        params![
            track.path,
            track.title,
            track.artist,
            track.album,
            track.duration,
            added_at,
            scan_id.or(track.scan_id.as_deref())
        ],
    )
    .map(|_| ()) //閿涘瞼鏁ゆ禍搴℃嫹閻ｃ儲鎼锋担婊呮畱閹存劕濮涙潻鏂挎礀閸婄》绱濈亸鍡楀従鏉烆剚宕叉稉鍝勫礋閸忓啰琚崹?() 鐏?Result<usize, Error> 鏉烆剚宕叉稉?Result<(), String>
    .map_err(|err| err.to_string())
}

fn find_existing_track_path(db: &Connection, path: &str) -> Result<Option<String>, String> {
    let normalized_path = normalized_track_path(path);
    let mut statement = db
        .prepare("SELECT path FROM tracks")
        .map_err(|err| err.to_string())?;
    let paths = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| err.to_string())?;

    for path in paths {
        let path = path.map_err(|err| err.to_string())?;
        if normalized_track_path(&path) == normalized_path {
            return Ok(Some(path));
        }
    }

    Ok(None)
}

fn read_track_added_at(db: &Connection, path: &str) -> Result<Option<String>, String> {
    db.query_row(
        "SELECT added_at FROM tracks WHERE path = ?1",
        params![path],
        |row| row.get(0),
    )
    .map(Some)
    .or_else(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        _ => Err(err.to_string()),
    })
}

fn current_sqlite_timestamp() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn find_existing_track_path_by_file_traits(
    db: &Connection,
    track: &Track,
) -> Result<Option<String>, String> {
    let Some(duration) = track.duration else {
        return Ok(None);
    };
    let Ok(file_size) = fs::metadata(&track.path).map(|metadata| metadata.len()) else {
        return Ok(None);
    };

    let mut statement = db
        .prepare("SELECT path, duration FROM tracks")
        .map_err(|err| err.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<u64>>(1)?))
        })
        .map_err(|err| err.to_string())?;

    let mut matched_path: Option<String> = None;
    for row in rows {
        let (path, existing_duration) = row.map_err(|err| err.to_string())?;
        if !is_close_duration(Some(duration), existing_duration) {
            continue;
        }
        let Ok(existing_size) = fs::metadata(&path).map(|metadata| metadata.len()) else {
            continue;
        };
        if existing_size != file_size {
            continue;
        }
        if matched_path.is_some() {
            return Ok(None);
        }
        matched_path = Some(path);
    }

    Ok(matched_path)
}

fn is_close_duration(left: Option<u64>, right: Option<u64>) -> bool {
    match (left, right) {
        (Some(left), Some(right)) => left.abs_diff(right) <= 2,
        _ => false,
    }
}

/**
 * 閸戣姤鏆熼幒銉︽暪娑撯偓娑?Path 瀵洜鏁?path閿涘苯鑻熸潻鏂挎礀娑撯偓娑?Result<Track, String>閵? * 閸戣姤鏆熸＃鏍у帥娴ｈ法鏁?lofty::read_from_path 閺傝纭舵禒?path 娑擃叀顕伴崣鏍叾妫版垶鏋冩禒璺哄帗閺佺増宓侀妴? * 閻掕泛鎮楅敍灞煎▏閻?tag 閺傝纭堕懢宄板絿閺嶅洨顒锋穱鈩冧紖閿涘苯鑻熸担璺ㄦ暏 map_or_else 閺傝纭舵径鍕倞闁挎瑨顕ら妴? * 婵″倹鐏夐弽鍥╊劮娣団剝浼呮稉铏光敄閿涘苯鍨担璺ㄦ暏 file_stem 閺傝纭堕懢宄板絿閺傚洣娆㈤崥宥忕礉楠炴湹濞囬悽?to_string_lossy 閺傝纭剁亸鍡楀従鏉烆剚宕叉稉鍝勭摟缁楋缚瑕嗛妴? * 婵″倹鐏夐弬鍥︽閸氬秷娴嗛幑顫礋鐎涙顑佹稉鎻掋亼鐠愩儻绱濋崚娆掔箲閸ョ偘绔存稉顏堟晩鐠囶垯淇婇幁顖樷偓? */
pub(crate) fn delete_missing_tracks_for_dir(
    db: &Connection,
    root: &Path,
    scanned_paths: &HashSet<String>,
) -> Result<(), String> {
    let root_prefix = normalized_folder_prefix(root);
    let scanned_paths = scanned_paths
        .iter()
        .map(|path| normalized_track_path(path))
        .collect::<HashSet<_>>();
    let mut statement = db
        .prepare("SELECT path FROM tracks")
        .map_err(|err| err.to_string())?;
    let paths = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| err.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|err| err.to_string())?;

    for path in paths {
        let normalized_path = normalized_track_path(&path);
        if normalized_path.starts_with(&root_prefix) && !scanned_paths.contains(&normalized_path) {
            db.execute("DELETE FROM tracks WHERE path = ?1", params![path])
                .map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

pub(crate) fn delete_tracks_for_dir(db: &Connection, root: &Path) -> Result<(), String> {
    let root_prefix = normalized_folder_prefix(root);
    let mut statement = db
        .prepare("SELECT path FROM tracks")
        .map_err(|err| err.to_string())?;
    let paths = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| err.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|err| err.to_string())?;

    for path in paths {
        if normalized_track_path(&path).starts_with(&root_prefix) {
            db.execute("DELETE FROM tracks WHERE path = ?1", params![path])
                .map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

pub(crate) fn delete_tracks_without_files(db: &Connection) -> Result<(), String> {
    let mut statement = db
        .prepare("SELECT path FROM tracks")
        .map_err(|err| err.to_string())?;
    let paths = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| err.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|err| err.to_string())?;

    for path in paths {
        if !Path::new(&path).is_file() {
            db.execute("DELETE FROM tracks WHERE path = ?1", params![path])
                .map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

fn normalized_folder_prefix(root: &Path) -> String {
    let mut value = normalized_track_path(&root.to_string_lossy());
    if !value.ends_with('/') {
        value.push('/');
    }
    value
}

fn normalized_track_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches("//?/")
        .to_ascii_lowercase()
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_required_text(value: String, message: &str) -> Result<String, String> {
    let value = value.trim().to_string();
    if value.is_empty() {
        Err(message.to_string())
    } else {
        Ok(value)
    }
}

fn write_track_file_metadata(
    path: &str,
    title: &str,
    artist: Option<&str>,
    album: Option<&str>,
    year: Option<u32>,
    genre: Option<&str>,
    track_number: Option<u32>,
) -> Result<(), String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty()
        || trimmed_path.starts_with("plugin://")
        || trimmed_path.starts_with("http://")
        || trimmed_path.starts_with("https://")
    {
        return Ok(());
    }

    let path = PathBuf::from(trimmed_path);
    if !path.is_file() {
        return Err("歌曲文件不存在。".to_string());
    }

    let mut tagged_file = lofty::read_from_path(&path).map_err(|err| err.to_string())?;
    if tagged_file.primary_tag_mut().is_none() {
        tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
    }

    if let Some(tag) = tagged_file.primary_tag_mut() {
        tag.set_title(title.to_string());
        match artist {
            Some(artist) => tag.set_artist(artist.to_string()),
            None => tag.remove_key(&ItemKey::TrackArtist),
        }
        match album {
            Some(album) => tag.set_album(album.to_string()),
            None => tag.remove_key(&ItemKey::AlbumTitle),
        }
        if let Some(year) = year {
            tag.set_year(year);
        }
        if let Some(genre) = genre {
            tag.insert_text(ItemKey::Genre, genre.to_string());
        }
        if let Some(track_number) = track_number {
            tag.set_track(track_number);
        }
    }

    tagged_file
        .save_to_path(&path, WriteOptions::default())
        .map_err(|err| err.to_string())
}

fn write_track_cover_metadata(path: &str, cover_path: &str) -> Result<(), String> {
    let track_path = normalized_local_file_path(path)?;
    let cover_path = PathBuf::from(cover_path.trim());
    if !cover_path.is_file() {
        return Err("封面图片不存在。".to_string());
    }

    let data = fs::read(&cover_path).map_err(|err| err.to_string())?;
    let mime_type = image_mime_type(&cover_path, &data)
        .ok_or_else(|| "请选择 jpg、png、gif、bmp 或 tiff 图片。".to_string())?;

    let mut tagged_file = lofty::read_from_path(&track_path).map_err(|err| err.to_string())?;
    if tagged_file.primary_tag_mut().is_none() {
        tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
    }

    if let Some(tag) = tagged_file.primary_tag_mut() {
        tag.remove_picture_type(PictureType::CoverFront);
        tag.push_picture(Picture::new_unchecked(
            PictureType::CoverFront,
            Some(mime_type),
            None,
            data,
        ));
    }

    tagged_file
        .save_to_path(&track_path, WriteOptions::default())
        .map_err(|err| err.to_string())
}

fn normalized_local_file_path(path: &str) -> Result<PathBuf, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty()
        || trimmed_path.starts_with("plugin://")
        || trimmed_path.starts_with("http://")
        || trimmed_path.starts_with("https://")
    {
        return Err("只能修改本地歌曲文件。".to_string());
    }

    let path = PathBuf::from(trimmed_path);
    if !path.is_file() {
        return Err("歌曲文件不存在。".to_string());
    }
    Ok(path)
}

fn image_mime_type(path: &Path, data: &[u8]) -> Option<MimeType> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg" | "jpeg") => return Some(MimeType::Jpeg),
        Some("png") => return Some(MimeType::Png),
        Some("gif") => return Some(MimeType::Gif),
        Some("bmp") => return Some(MimeType::Bmp),
        Some("tif" | "tiff") => return Some(MimeType::Tiff),
        _ => {}
    }

    if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(MimeType::Jpeg)
    } else if data.starts_with(b"\x89PNG\r\n\x1A\n") {
        Some(MimeType::Png)
    } else if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        Some(MimeType::Gif)
    } else if data.starts_with(b"BM") {
        Some(MimeType::Bmp)
    } else if data.starts_with(b"II*\0") || data.starts_with(b"MM\0*") {
        Some(MimeType::Tiff)
    } else {
        None
    }
}
