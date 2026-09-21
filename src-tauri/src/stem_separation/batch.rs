use super::{
    models::{SeparationPlan, SeparationStatus},
    EnvironmentState, SeparationState,
};
use crate::{
    api_response::ApiResponse,
    player::{mono_cache_dir, PlayerState},
};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchItem {
    source: String,
    stage: String,
    message: Option<String>,
    vocals_path: Option<String>,
    accompaniment_path: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchStatus {
    #[serde(skip)]
    started: Instant,
    elapsed_ms: u64,
    id: String,
    stage: String,
    source: String,
    output_dir: String,
    message: Option<String>,
    items: Vec<BatchItem>,
    current: Option<SeparationStatus>,
}

impl BatchStatus {
    fn running(&self) -> bool {
        matches!(self.stage.as_str(), "scanning" | "running" | "cancelling")
    }
}

#[derive(Clone, Default)]
pub(crate) struct BatchState(Arc<Mutex<Option<BatchStatus>>>);

impl BatchState {
    pub fn running(&self) -> bool {
        self.0
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(BatchStatus::running)
    }
    pub(super) fn while_idle<T>(
        &self,
        action: impl FnOnce() -> Result<T, String>,
    ) -> Result<T, String> {
        let locked = self.0.lock().unwrap();
        if locked.as_ref().is_some_and(BatchStatus::running) {
            return Err("文件夹分离正在运行，请等待完成或先取消。".into());
        }
        action()
    }
    pub fn cancel(&self, separation: &SeparationState) -> Result<(), String> {
        let mut locked = self.0.lock().unwrap();
        if let Some(status) = locked.as_mut().filter(|s| s.running()) {
            status.stage = "cancelling".into();
            if let Some(job) = &status.current {
                if job.is_running() {
                    separation.cancel(&job.id)?;
                }
            }
        }
        Ok(())
    }
    fn cancelled(&self) -> bool {
        self.0
            .lock()
            .unwrap()
            .as_ref()
            .is_none_or(|s| s.stage == "cancelling")
    }

    fn run(
        &self,
        separation: &SeparationState,
        check_plugin: impl Fn() -> Result<(), String>,
        plugin_id: &str,
        python: &str,
        plan: SeparationPlan,
        source: &Path,
        output: &Path,
        model_cache: &Path,
    ) -> Result<(), String> {
        let files = collect_music(source, output, || self.cancelled())?;
        if files.is_empty() && !self.cancelled() {
            return Err("所选位置没有支持的音乐文件。".into());
        }
        {
            let mut locked = self.0.lock().unwrap();
            let status = locked.as_mut().unwrap();
            if status.stage == "cancelling" {
                return Ok(());
            }
            status.items = files
                .iter()
                .map(|p| BatchItem {
                    source: p.to_string_lossy().into(),
                    stage: "pending".into(),
                    message: None,
                    vocals_path: None,
                    accompaniment_path: None,
                })
                .collect();
            status.stage = "running".into();
        }
        for (index, input) in files.iter().enumerate() {
            if self.cancelled() {
                break;
            }
            let result = (|| {
                check_plugin()?;
                let parent = output.join(super::karaoke::cache_key(input)?);
                if let Some(ready) = cached_output(&parent) {
                    return Ok((ready, true));
                }
                fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
                let job = {
                    let mut locked = self.0.lock().unwrap();
                    let status = locked.as_mut().unwrap();
                    if status.stage == "cancelling" {
                        return Err("已取消".into());
                    }
                    let job = separation.start_with_session(
                        plugin_id.into(),
                        python,
                        plan.clone(),
                        input,
                        &parent,
                        model_cache,
                        true,
                    )?;
                    status.items[index].stage = "running".into();
                    status.current = Some(job.clone());
                    job
                };
                loop {
                    let next = separation.status()?.ok_or("分离任务不存在")?;
                    if next.id != job.id {
                        return Err("分离任务已改变".into());
                    }
                    self.0.lock().unwrap().as_mut().unwrap().current = Some(next.clone());
                    if !next.is_running() {
                        if next.stage != "done" {
                            return Err(next.message.unwrap_or_else(|| "分离已取消".into()));
                        }
                        let ready = PathBuf::from(&next.output_dir);
                        let name = ready.file_name().ok_or("输出目录无效")?.to_string_lossy();
                        fs::write(parent.join("ready.txt"), name.as_bytes())
                            .map_err(|e| e.to_string())?;
                        return Ok((ready, false));
                    }
                    thread::sleep(Duration::from_millis(200));
                }
            })();
            let mut locked = self.0.lock().unwrap();
            let status = locked.as_mut().unwrap();
            let cancelled = status.stage == "cancelling";
            let item = &mut status.items[index];
            match result {
                Ok((ready, reused)) => {
                    item.stage = if reused { "reused" } else { "done" }.into();
                    item.vocals_path = Some(ready.join("vocals.wav").to_string_lossy().into());
                    item.accompaniment_path =
                        Some(ready.join("accompaniment.wav").to_string_lossy().into());
                }
                Err(error) => {
                    item.stage = if cancelled { "cancelled" } else { "error" }.into();
                    item.message = Some(error);
                }
            }
            status.current = None;
        }
        Ok(())
    }
}

fn is_music_file(path: &Path) -> bool {
    crate::scanner::is_audio_file(path)
        || path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("mp4"))
}

fn collect_music(
    source: &Path,
    output: &Path,
    cancelled: impl Fn() -> bool,
) -> Result<Vec<PathBuf>, String> {
    let source = source.canonicalize().map_err(|e| e.to_string())?;
    if source.is_file() {
        return if is_music_file(&source) {
            Ok(vec![source])
        } else {
            Err("不支持的音乐格式。".into())
        };
    }
    let output = output
        .canonicalize()
        .unwrap_or_else(|_| output.to_path_buf());
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(source)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| e.path() != output)
    {
        if cancelled() {
            break;
        }
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().is_file() && is_music_file(entry.path()) {
            files.push(entry.path().to_path_buf());
        }
    }
    files.sort();
    Ok(files)
}

pub(super) fn cached_output(parent: &Path) -> Option<PathBuf> {
    let name = fs::read_to_string(parent.join("ready.txt")).ok()?;
    let output = parent.join(name.trim()).canonicalize().ok()?;
    (output.starts_with(parent.canonicalize().ok()?)
        && super::runtime::valid_wav(&output.join("vocals.wav"))
        && super::runtime::valid_wav(&output.join("accompaniment.wav")))
    .then_some(output)
}

#[tauri::command]
pub(crate) async fn stem_batch_start(
    app: AppHandle,
    plugin_id: String,
    source: String,
) -> ApiResponse<BatchStatus> {
    ApiResponse::from_result(
        tauri::async_runtime::spawn_blocking(move || {
            let (python, plan) = super::plugin_plan(&app, &plugin_id)?;
            let output = mono_cache_dir(&app.state::<PlayerState>().cache_dir()?).join("karaoke");
            let model_cache = app
                .path()
                .app_cache_dir()
                .map_err(|e| e.to_string())?
                .join("demucs");
            fs::create_dir_all(&output).map_err(|e| e.to_string())?;
            let state = app.state::<BatchState>().inner().clone();
            let snapshot = app.state::<EnvironmentState>().while_idle(|| {
                let mut locked = state.0.lock().unwrap();
                if locked.as_ref().is_some_and(BatchStatus::running)
                    || app
                        .state::<SeparationState>()
                        .status()?
                        .is_some_and(|s| s.is_running())
                {
                    return Err("已有分离任务正在运行。".into());
                }
                let status = BatchStatus {
                    started: Instant::now(),
                    elapsed_ms: 0,
                    id: uuid::Uuid::new_v4().to_string(),
                    stage: "scanning".into(),
                    source: source.clone(),
                    output_dir: output.to_string_lossy().into(),
                    message: None,
                    items: Vec::new(),
                    current: None,
                };
                *locked = Some(status.clone());
                Ok(status)
            })?;
            thread::spawn(move || {
                let result = state.run(
                    &app.state::<SeparationState>(),
                    || super::installed_plugin(&app, &plugin_id).map(|_| ()),
                    &plugin_id,
                    &python,
                    plan,
                    Path::new(&source),
                    &output,
                    &model_cache,
                );
                app.state::<SeparationState>().finish_batch();
                let mut locked = state.0.lock().unwrap();
                let status = locked.as_mut().unwrap();
                status.elapsed_ms = status.started.elapsed().as_millis() as u64;
                if status.stage == "cancelling" {
                    status.stage = "cancelled".into();
                } else if let Err(error) = result {
                    status.stage = "error".into();
                    status.message = Some(error);
                } else {
                    status.stage = "done".into();
                }
            });
            Ok(snapshot)
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r),
    )
}

#[tauri::command]
pub(crate) fn stem_batch_status(state: State<'_, BatchState>) -> ApiResponse<Option<BatchStatus>> {
    let mut snapshot = state.0.lock().unwrap().clone();
    if let Some(status) = snapshot.as_mut().filter(|s| s.running()) {
        status.elapsed_ms = status.started.elapsed().as_millis() as u64;
    }
    ApiResponse::success(snapshot)
}

#[tauri::command]
pub(crate) fn stem_batch_cancel(
    state: State<'_, BatchState>,
    separation: State<'_, SeparationState>,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(state.cancel(&separation))
}

#[tauri::command]
pub(crate) fn stem_output_directory(state: State<'_, PlayerState>) -> ApiResponse<String> {
    ApiResponse::from_result(
        state
            .cache_dir()
            .map(|p| mono_cache_dir(&p).join("karaoke").to_string_lossy().into()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state(source: &Path, output: &Path) -> BatchState {
        BatchState(Arc::new(Mutex::new(Some(BatchStatus {
            started: Instant::now(),
            elapsed_ms: 0,
            id: "test".into(),
            stage: "scanning".into(),
            source: source.to_string_lossy().into(),
            output_dir: output.to_string_lossy().into(),
            message: None,
            items: vec![],
            current: None,
        }))))
    }

    #[test]
    fn scan_includes_nested_music_but_excludes_output_and_non_audio() {
        let root = std::env::temp_dir().join(format!("mono-batch-scan-{}", uuid::Uuid::new_v4()));
        let nested = root.join("子目录");
        let output = root.join("cache/karaoke");
        fs::create_dir_all(&nested).unwrap();
        fs::create_dir_all(&output).unwrap();
        for file in [
            root.join("one.MP3"),
            nested.join("two.flac"),
            root.join("notes.txt"),
            output.join("accompaniment.wav"),
        ] {
            fs::write(file, b"test").unwrap();
        }
        let files = collect_music(&root, &output, || false).unwrap();
        assert_eq!(files.len(), 2);
        assert!(files.iter().any(|p| p.ends_with("two.flac")));
        assert!(collect_music(&root, &output, || true).unwrap().is_empty());
        for file in [
            root.join("one.MP3"),
            nested.join("two.flac"),
            root.join("notes.txt"),
            output.join("accompaniment.wav"),
        ] {
            fs::remove_file(file).unwrap();
        }
        fs::remove_dir(nested).unwrap();
        fs::remove_dir(&output).unwrap();
        fs::remove_dir(root.join("cache")).unwrap();
        fs::remove_dir(root).unwrap();
    }

    #[test]
    fn batch_reservation_blocks_other_jobs_even_between_tracks() {
        let batch = state(Path::new("input"), Path::new("output"));
        assert!(batch.while_idle(|| Ok(())).is_err());
        batch.cancel(&SeparationState::default()).unwrap();
        assert!(batch.cancelled());
        assert!(batch.while_idle(|| Ok(())).is_err());
        batch.0.lock().unwrap().as_mut().unwrap().stage = "cancelled".into();
        assert!(batch.while_idle(|| Ok(())).is_ok());
    }

    #[test]
    #[ignore = "Requires MONO_STEM_TEST_PYTHON and MONO_STEM_TEST_CACHE; runs actual Demucs"]
    fn real_batch_continues_after_failure_and_reuses_outputs() {
        let python = std::env::var("MONO_STEM_TEST_PYTHON").unwrap();
        let models = PathBuf::from(std::env::var("MONO_STEM_TEST_CACHE").unwrap());
        let root = std::env::temp_dir().join(format!("mono-batch-real-{}", uuid::Uuid::new_v4()));
        let input = root.join("音乐");
        let output = root.join("cache");
        fs::create_dir_all(&input).unwrap();
        fs::create_dir_all(&output).unwrap();
        let bytes = 44100u32 * 2;
        let mut wav = Vec::new();
        wav.extend(b"RIFF");
        wav.extend((36 + bytes).to_le_bytes());
        wav.extend(b"WAVEfmt ");
        wav.extend(16u32.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(44100u32.to_le_bytes());
        wav.extend(88200u32.to_le_bytes());
        wav.extend(2u16.to_le_bytes());
        wav.extend(16u16.to_le_bytes());
        wav.extend(b"data");
        wav.extend(bytes.to_le_bytes());
        for i in 0..44100 {
            wav.extend((((i as f64 * 0.07).sin() * 4000.0) as i16).to_le_bytes());
        }
        fs::write(input.join("a-broken.wav"), b"not audio").unwrap();
        fs::write(input.join("b-音乐.wav"), &wav).unwrap();
        fs::write(input.join("c-音乐.wav"), &wav).unwrap();
        let batch = state(&input, &output);
        let separation = SeparationState::default();
        let plan = || SeparationPlan {
            engine: "demucs".into(),
            model: "htdemucs_6s".into(),
            device: "cpu".into(),
        };
        batch
            .run(
                &separation,
                || Ok(()),
                "test",
                &python,
                plan(),
                &input,
                &output,
                &models,
            )
            .unwrap();
        let items = batch.0.lock().unwrap().as_ref().unwrap().items.clone();
        assert_eq!(items[0].stage, "error");
        assert_eq!(items[1].stage, "done", "{:?}", items[1].message);
        assert_eq!(items[2].stage, "done", "{:?}", items[2].message);
        batch
            .run(
                &separation,
                || Ok(()),
                "test",
                &python,
                plan(),
                &input,
                &output,
                &models,
            )
            .unwrap();
        assert_eq!(
            batch.0.lock().unwrap().as_ref().unwrap().items[1].stage,
            "reused"
        );
        let cancelled = state(&input, &output);
        let runner = cancelled.clone();
        let worker = separation.clone();
        let cancel_input = input.clone();
        let cancel_output = output.clone();
        let task = thread::spawn(move || {
            runner.run(
                &worker,
                || Ok(()),
                "test",
                &python,
                plan(),
                &cancel_input,
                &cancel_output,
                &models,
            )
        });
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while cancelled
            .0
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .current
            .is_none()
        {
            assert!(std::time::Instant::now() < deadline);
            thread::sleep(Duration::from_millis(10));
        }
        cancelled.cancel(&separation).unwrap();
        task.join().unwrap().unwrap();
        assert_eq!(
            cancelled.0.lock().unwrap().as_ref().unwrap().items[1].stage,
            "pending"
        );
        // Remove only files created by this test, deepest paths first.
        let checked_root = root.canonicalize().unwrap();
        let mut entries: Vec<_> = walkdir::WalkDir::new(&root)
            .contents_first(true)
            .into_iter()
            .map(Result::unwrap)
            .collect();
        for entry in entries.drain(..) {
            assert!(entry
                .path()
                .canonicalize()
                .unwrap()
                .starts_with(&checked_root));
            if entry.file_type().is_dir() {
                fs::remove_dir(entry.path()).unwrap();
            } else {
                fs::remove_file(entry.path()).unwrap();
            }
        }
    }
}
