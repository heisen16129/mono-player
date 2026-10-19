use crate::{api_response::ApiResponse, state::AppState, workers::scanner::ScanWorkerState};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Default)]
pub(crate) struct ScanBatchState(Arc<Mutex<ScanBatchProgress>>);

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanBatchProgress {
    running: bool,
    canceling: bool,
    current_folder: String,
    completed_folders: usize,
    total_folders: usize,
    scanned_tracks: usize,
}

struct BatchGuard(ScanBatchState);
impl Drop for BatchGuard {
    fn drop(&mut self) {
        if let Ok(mut progress) = self.0 .0.lock() {
            progress.running = false;
        }
    }
}

impl ScanBatchState {
    pub(crate) fn with_idle<T>(&self, action: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
        let progress = self.0.lock().map_err(|e| e.to_string())?;
        if progress.running { return Err("扫描期间不能修改曲库目录，请等待扫描完成或取消扫描".into()); }
        action()
    }

    fn begin(&self, total: usize, worker: &ScanWorkerState) -> Result<BatchGuard, String> {
        let mut progress = self.0.lock().map_err(|e| e.to_string())?;
        if progress.running {
            return Err("A music scan is already running.".into());
        }
        worker.reset_cancel();
        *progress = ScanBatchProgress {
            running: true,
            total_folders: total,
            ..Default::default()
        };
        Ok(BatchGuard(self.clone()))
    }
}

fn publish(app: &AppHandle) {
    if let Ok(progress) = app.state::<ScanBatchState>().0.lock() {
        let _ = app.emit("scan://batch", progress.clone());
    }
}

pub(super) fn track_scanned(app: &AppHandle) {
    if let Ok(mut progress) = app.state::<ScanBatchState>().0.lock() {
        progress.scanned_tracks += 1;
    }
    publish(app);
}

pub(super) fn cancel(app: &AppHandle) -> Result<bool, String> {
    let state = app.state::<ScanBatchState>();
    let mut progress = state.0.lock().map_err(|e| e.to_string())?;
    if !progress.running {
        return Ok(false);
    }
    progress.canceling = true;
    app.state::<ScanWorkerState>().cancel()?;
    drop(progress);
    publish(app);
    Ok(true)
}

pub(super) async fn run(
    paths: Vec<String>,
    app: AppHandle,
) -> Result<super::ScanMusicDirResult, String> {
    let paths = crate::library_directories::normalize(paths)?;
    let state = app.state::<ScanBatchState>();
    let worker = app.state::<ScanWorkerState>();
    let guard = state.begin(paths.len(), &worker)?;
    publish(&app);
    let result = async {
        let directories = crate::library_directories::register_scan_paths(&app, paths.clone())?;
        let mut canceled = false;
        for path in paths {
            if worker.is_canceled() {
                canceled = true;
                break;
            }
            {
                let mut progress = state.0.lock().map_err(|e| e.to_string())?;
                progress.current_folder = path.clone();
                progress.scanned_tracks = 0;
            }
            publish(&app);
            match super::scan_music_dir_inner(path, app.clone()).await {
                Ok(_) => {
                    state.0.lock().map_err(|e| e.to_string())?.completed_folders += 1;
                }
                Err(_) if worker.is_canceled() => {
                    canceled = true;
                    break;
                }
                Err(error) => return Err(error),
            }
            publish(&app);
        }
        canceled |= worker.is_canceled();
        let db = app.state::<AppState>();
        let db = db.db.lock().map_err(|e| e.to_string())?;
        let tracks = crate::database::read_tracks(&db)?;
        Ok(super::ScanMusicDirResult {
            tracks,
            canceled,
            music_dirs: directories.music_dirs,
            music_dir: directories.music_dir,
        })
    }
    .await;
    drop(guard);
    publish(&app);
    result
}

#[tauri::command]
pub(crate) async fn scan_music_dirs(
    paths: Vec<String>,
    app: AppHandle,
) -> Result<ApiResponse<super::ScanMusicDirResult>, String> {
    Ok(ApiResponse::from_result(run(paths, app).await))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_overlap_and_preserves_cancellation_until_next_batch() {
        let state = ScanBatchState::default();
        let worker = ScanWorkerState::default();
        let guard = state.begin(3, &worker).unwrap();
        worker.cancel().unwrap();
        assert!(worker.is_canceled());
        assert_eq!(worker.run_scan("unused".into(), |_| panic!("must not start the next directory")).unwrap_err(), "Scan canceled.");
        assert!(state.begin(1, &worker).is_err());
        assert!(state.with_idle(|| Ok(())).is_err());
        assert!(worker.is_canceled());
        drop(guard);
        assert!(state.with_idle(|| Ok(())).is_ok());
        let _next = state.begin(1, &worker).unwrap();
        assert!(!worker.is_canceled());
        assert_eq!(state.0.lock().unwrap().total_folders, 1);
    }
}
