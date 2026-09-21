use super::{models::SeparationStatus, EnvironmentState, SeparationState};
use crate::{api_response::ApiResponse, player::{mono_cache_dir, PlayerState}, workers::audio::AudioWorkerState};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, path::Path, time::UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub(crate) fn karaoke_set_vocals(app: AppHandle, source: String, gain: f32) -> ApiResponse<()> {
    ApiResponse::from_empty_result(app.state::<AudioWorkerState>().set_karaoke_vocals(source, gain))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KaraokePreparation {
    accompaniment: Option<String>,
    job: Option<SeparationStatus>,
}

pub(super) fn cache_key(path: &Path) -> Result<String, String> {
    let metadata = path.metadata().map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    Ok(format!(
        "{:x}",
        Sha256::digest(
            format!(
                "htdemucs_6s:{}:{}:{modified}",
                path.display(),
                metadata.len()
            )
            .as_bytes()
        )
    ))
}

#[tauri::command]
pub(crate) async fn karaoke_has_accompaniment(app: AppHandle, source: String, provider_id: Option<String>, track_id: Option<String>) -> ApiResponse<bool> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || {
        let worker = app.state::<AudioWorkerState>();
        let input = if Path::new(&source).is_file() {
            Some(std::path::PathBuf::from(&source))
        } else {
            worker.karaoke_source(&source).ok().or_else(|| {
                worker.completed_cache_for_track(provider_id.as_deref()?, track_id.as_deref()?, None).map(|cache| cache.path)
            })
        };
        let Some(input) = input.and_then(|p| p.canonicalize().ok()) else { return Ok(false); };
        let parent = mono_cache_dir(&app.state::<PlayerState>().cache_dir()?).join("karaoke").join(cache_key(&input)?);
        Ok(super::batch::cached_output(&parent).is_some())
    }).await.map_err(|e| e.to_string()).and_then(|r| r))
}

#[tauri::command]
pub(crate) async fn karaoke_prepare(
    app: AppHandle,
    plugin_id: String,
    source: String,
    check_only: Option<bool>,
) -> ApiResponse<KaraokePreparation> {
    ApiResponse::from_result(
        tauri::async_runtime::spawn_blocking(move || {
            super::installed_plugin(&app, &plugin_id)?;
            let input = app
                .state::<AudioWorkerState>()
                .karaoke_source(&source)?
                .canonicalize()
                .map_err(|e| e.to_string())?;
            let cache = mono_cache_dir(&app.state::<PlayerState>().cache_dir()?);
            let model_cache = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("demucs");
            let output = cache.join("karaoke").join(cache_key(&input)?);
            // Only successful jobs publish this marker; partial outputs are never reused.
            let marker = output.join("ready.txt");
            if let Ok(name) = fs::read_to_string(&marker) {
                let candidate = output.join(name.trim()).join("accompaniment.wav");
                if candidate.is_file()
                    && candidate
                        .canonicalize()
                        .ok()
                        .zip(output.canonicalize().ok())
                        .is_some_and(|(p, root)| p.starts_with(root))
                {
                    return Ok(KaraokePreparation {
                        accompaniment: Some(candidate.to_string_lossy().into()),
                        job: None,
                    });
                }
            }
            if check_only.unwrap_or(false) {
                return Ok(KaraokePreparation { accompaniment: None, job: None });
            }
            let (python, plan) = super::plugin_plan(&app, &plugin_id)?;
            fs::create_dir_all(&output).map_err(|e| e.to_string())?;
            let job = app.state::<EnvironmentState>().while_idle(|| app.state::<super::batch::BatchState>().while_idle(|| {
                app.state::<SeparationState>().start(
                    plugin_id,
                    &python,
                    plan,
                    &input,
                    &output,
                    &model_cache,
                )
            }))?;
            Ok(KaraokePreparation {
                accompaniment: None,
                job: Some(job),
            })
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r),
    )
}

#[tauri::command]
pub(crate) async fn karaoke_switch(
    app: AppHandle,
    plugin_id: String,
    source: String,
    accompaniment: Option<String>,
) -> ApiResponse<()> {
    ApiResponse::from_result(
        tauri::async_runtime::spawn_blocking(move || {
            if let Some(path) = &accompaniment {
                super::installed_plugin(&app, &plugin_id)?;
                let cache = mono_cache_dir(&app.state::<PlayerState>().cache_dir()?).join("karaoke");
                let path = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
                let cache = cache.canonicalize().map_err(|e| e.to_string())?;
                if !path.starts_with(cache)
                    || path.file_name().and_then(|s| s.to_str()) != Some("accompaniment.wav")
                {
                    return Err("无效的伴奏文件。".into());
                }
                let parent = path.parent().ok_or("无效的伴奏目录")?;
                let output = parent.parent().ok_or("无效的缓存目录")?;
                let input = app.state::<AudioWorkerState>().karaoke_source(&source)?
                    .canonicalize().map_err(|e| e.to_string())?;
                let expected_key = cache_key(&input)?;
                if output.file_name().and_then(|name| name.to_str()) != Some(expected_key.as_str()) {
                    return Err("伴奏不属于当前歌曲，请重新准备。".into());
                }
                let completed = app.state::<SeparationState>().status()?.is_some_and(|job| {
                    job.stage == "done"
                        && job
                            .accompaniment_path
                            .as_deref()
                            .and_then(|p| Path::new(p).canonicalize().ok())
                            .as_ref()
                            == Some(&path)
                });
                let name = parent
                    .file_name()
                    .ok_or("无效的缓存目录")?
                    .to_string_lossy();
                if completed {
                    fs::write(output.join("ready.txt"), name.as_bytes())
                        .map_err(|e| e.to_string())?;
                } else if fs::read_to_string(output.join("ready.txt")).ok().as_deref()
                    != Some(name.as_ref())
                {
                    return Err("伴奏尚未生成完成。".into());
                }
            }
            app.state::<AudioWorkerState>()
                .switch_karaoke(&source, accompaniment)?;
            // A paused player's watcher may already have stopped.
            let snapshot = app.state::<AudioWorkerState>().state()?;
            let _ = app.emit("player://state", snapshot);
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r),
    )
}
