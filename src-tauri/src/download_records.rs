use crate::{api_response::ApiResponse, database::download_records as repo, downloads::{DownloadQueueEvent, DownloadTrackRequest, EnqueueDownloadResult}, models::download_record::DownloadRecord, state::AppState, workers::download::DownloadWorkerState};
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub(crate) fn download_records_snapshot(state: State<'_, AppState>) -> ApiResponse<serde_json::Value> {
    ApiResponse::from_result((|| {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let downloaded = repo::list_category(&db, "downloaded")?;
        let downloading = repo::list_category(&db, "downloading")?;
        let downloaded_keys: Vec<_> = downloaded.iter().map(|item| &item.id).collect();
        let pending_keys: Vec<_> = downloading.iter().filter(|item| matches!(item.status.as_str(), "downloading" | "paused")).map(|item| &item.id).collect();
        Ok(serde_json::json!({"downloaded":downloaded,"downloading":downloading,"downloadedKeys":downloaded_keys,"pendingKeys":pending_keys}))
    })())
}

pub(crate) fn handle_event(app: &AppHandle, mut event: DownloadQueueEvent) {
    let state = app.state::<AppState>();
    let result = (|| repo::apply_event(&*state.db.lock().map_err(|e| e.to_string())?, &event))();
    match result {
        Ok(Some(item)) => { event.task_id = item.id; let _ = app.emit("download://event", event); }
        Ok(None) => (),
        Err(error) => eprintln!("[downloads] {error}"),
    }
}

pub(crate) fn enqueue(app: &AppHandle, request: DownloadTrackRequest) -> Result<EnqueueDownloadResult, String> {
    if request.download_dir.trim().is_empty() { return Err("请先在设置中选择下载位置".into()); }
    let track = &request.track;
    let source_name = track.source_name.clone().unwrap_or_else(|| "本地".into());
    let source_id = track.source_id.clone().unwrap_or_else(|| track.id.to_string());
    let id = format!("{source_name}:{source_id}");
    let run = uuid::Uuid::new_v4().to_string();
    {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        if let Some((item, _)) = repo::get(&db, &id)? {
            if matches!(item.status.as_str(), "downloading" | "paused" | "downloaded") {
                return Ok(EnqueueDownloadResult { task_id: id });
            }
        }
        let item = DownloadRecord { id: id.clone(), title: track.title.clone(), artist: track.artist.clone(), album: track.album.clone(), duration: track.duration, source_name, source_id, artwork: track.artwork.clone(), status: "downloading".into(), progress: 0, created_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64, download_request: Some(request.clone()), file_path: None, lyrics_path: None, error: None };
        repo::save(&db, &item, Some(&run))?;
    }
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = crate::downloads::resolve_download_track_request(&app, request)
            .and_then(|resolved| app.state::<DownloadWorkerState>().enqueue_download_track(run.clone(), resolved));
        if let Err(error) = result {
            handle_event(&app, DownloadQueueEvent { task_id: run, status: "failed".into(), progress: 0, file_path: None, lyrics_path: None, error: Some(error) });
        }
    });
    Ok(EnqueueDownloadResult { task_id: id })
}

#[tauri::command]
pub(crate) async fn download_record_action(app: AppHandle, id: String, action: String) -> ApiResponse<()> {
    ApiResponse::from_empty_result(tauri::async_runtime::spawn_blocking(move || action_inner(&app, &id, &action)).await.map_err(|e| e.to_string()).and_then(|r| r))
}

fn action_inner(app: &AppHandle, id: &str, action: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    let (item, run) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        repo::get(&db, id)?.ok_or("下载记录不存在")?
    };
    match action {
        "pause" | "resume" if run.is_some() => {
            let expected = if action == "pause" { "downloading" } else { "paused" };
            if item.status != expected { return Err("下载状态已变化，请刷新后重试".into()); }
            app.state::<DownloadWorkerState>().control(run.as_deref().unwrap(), action)?;
            let db = state.db.lock().map_err(|e| e.to_string())?;
            if let Some((mut current, current_run)) = repo::get(&db, id)? {
                if current_run == run && current.status == expected {
                    current.status = if action == "pause" { "paused" } else { "downloading" }.into();
                    repo::save(&db, &current, run.as_deref())?;
                }
            }
        }
        "resume" | "retry" => {
            if !matches!(item.status.as_str(), "failed" | "paused") { return Err("该记录不能重试".into()); }
            let request = item.download_request.clone().ok_or("缺少下载信息，请重新下载")?;
            {
                let db = state.db.lock().map_err(|e| e.to_string())?;
                let mut item = item;
                item.status = "failed".into();
                repo::save(&db, &item, None)?;
            }
            enqueue(app, request)?;
        }
        "clear" | "delete" => {
            if action == "delete" {
                if item.status != "downloaded" { return Err("只能删除已完成的下载文件".into()); }
                let response = crate::downloads::delete_downloaded_track_file(crate::downloads::DeleteDownloadedTrackFileRequest { file_path: item.file_path, lyrics_path: item.lyrics_path, download_dir: None, title: None, artist: None });
                if response.code != 1 { return Err(response.message); }
            } else if let Some(run) = run { app.state::<DownloadWorkerState>().control(&run, "cancel")?; }
            repo::remove(&*state.db.lock().map_err(|e| e.to_string())?, id)?;
        }
        _ => return Err("不支持的下载操作".into()),
    }
    Ok(())
}

pub(crate) fn worker_stopped(app: &AppHandle) {
    let state = app.state::<AppState>();
    let result = (|| -> Result<Vec<DownloadQueueEvent>, String> {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut events = Vec::new();
        for item in repo::list(&db)? {
            if let Some((_, Some(run))) = repo::get(&db, &item.id)? {
                let event = DownloadQueueEvent { task_id: run, status: "failed".into(), progress: item.progress, file_path: None, lyrics_path: None, error: Some("下载进程已退出，请重试".into()) };
                if let Some(item) = repo::apply_event(&db, &event)? {
                    events.push(DownloadQueueEvent { task_id: item.id, ..event });
                }
            }
        }
        Ok(events)
    })();
    match result {
        Ok(events) => for event in events { let _ = app.emit("download://event", event); },
        Err(error) => eprintln!("[downloads] {error}"),
    }
}
