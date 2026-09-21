use super::models::{SeparationPlan, SeparationStatus};
use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    path::Path,
    process::Child,
    sync::{Arc, Mutex},
    thread,
};

use super::session::Session;

struct Job {
    status: SeparationStatus,
    child: Option<Arc<Mutex<Child>>>,
    cancelled: bool,
}

#[derive(Clone, Default)]
pub(crate) struct SeparationState(Arc<Mutex<Option<Job>>>, Arc<Mutex<Option<Session>>>);

impl SeparationState {
    pub fn status(&self) -> Result<Option<SeparationStatus>, String> {
        Ok(self
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .as_ref()
            .map(|job| job.status.clone()))
    }

    pub(super) fn start(
        &self,
        plugin_id: String,
        python: &str,
        plan: SeparationPlan,
        source: &Path,
        output_parent: &Path,
        cache_dir: &Path,
    ) -> Result<SeparationStatus, String> {
        self.start_with_session(plugin_id, python, plan, source, output_parent, cache_dir, false)
    }

    pub(super) fn finish_batch(&self) {
        self.1.lock().unwrap().take();
    }

    pub(super) fn start_with_session(
        &self, plugin_id: String, python: &str, plan: SeparationPlan,
        source: &Path, output_parent: &Path, cache_dir: &Path, reuse: bool,
    ) -> Result<SeparationStatus, String> {
        plan.validate()?;
        if !source.is_file() || !output_parent.is_dir() {
            return Err("请选择存在的本地音乐文件和输出文件夹。".to_string());
        }
        let source = source.canonicalize().map_err(|e| e.to_string())?;
        let parent = output_parent.canonicalize().map_err(|e| e.to_string())?;
        let mut current = self.0.lock().map_err(|e| e.to_string())?;
        if current.as_ref().is_some_and(|job| job.status.is_running()) {
            return Err("已有分离任务正在运行，请等待完成或先取消。".to_string());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let output = parent.join(format!("mono-stems-{id}"));
        fs::create_dir(&output).map_err(|e| e.to_string())?;
        let request = json!({
            "source": source, "outputDir": output, "cacheDir": cache_dir,
            "model": plan.model, "device": plan.device,
        });
        let session = if reuse { self.1.lock().unwrap().take() } else { None };
        let reused = session.is_some();
        let mut session = match session.map(Ok).unwrap_or_else(|| Session::start(python)) {
            Ok(session) => session,
            Err(error) => { cleanup_outputs(&output); return Err(error); }
        };
        if let Err(error) = session.send(&request) {
            cleanup_outputs(&output);
            return Err(error);
        }
        let child = session.child.clone();
        let status = SeparationStatus {
            id: id.clone(),
            plugin_id,
            stage: if reused { "separating" } else { "loading" }.into(),
            progress: None,
            device: None,
            message: None,
            output_dir: output.to_string_lossy().into_owned(),
            vocals_path: None,
            accompaniment_path: None,
        };
        *current = Some(Job {
            status: status.clone(),
            child: Some(child),
            cancelled: false,
        });
        drop(current);
        let state = self.clone();
        thread::spawn(move || {
            let result = loop {
                match session.receive() {
                    Ok(event) => {
                        state.update_event(&id, event.clone());
                        if event["stage"] == "done" { break Ok(true); }
                        if event["stage"] == "error" { break Ok(false); }
                    }
                    Err(error) => break Err(error),
                }
            };
            let mut locked = state.0.lock().unwrap();
            let job = locked.as_mut().unwrap();
            job.child = None;
            if reuse && !job.cancelled && result.is_ok() {
                *state.1.lock().unwrap() = Some(session);
            } else {
                drop(session);
            }
            let vocals = output.join("vocals.wav");
            let accompaniment = output.join("accompaniment.wav");
            if job.cancelled {
                job.status.stage = "cancelled".into();
                job.status.message = None;
            } else if matches!(result, Ok(true)) && valid_wav(&vocals) && valid_wav(&accompaniment)
            {
                job.status.stage = "done".into();
                job.status.progress = Some(100);
                job.status.vocals_path = Some(vocals.to_string_lossy().into_owned());
                job.status.accompaniment_path = Some(accompaniment.to_string_lossy().into_owned());
            } else {
                job.status.stage = "error".into();
                if job.status.message.is_none() {
                    job.status.message = Some(result.err().unwrap_or_else(|| {
                        "分离失败，请检查模型下载、可用内存和分离环境。".into()
                    }));
                }
            }
            if job.status.stage != "done" {
                job.status.progress = None;
                cleanup_outputs(&output);
            }
        });
        Ok(status)
    }

    fn update_event(&self, id: &str, event: Value) {
        let mut locked = self.0.lock().unwrap();
        let Some(job) = locked
            .as_mut()
            .filter(|job| job.status.id == id && !job.cancelled)
        else {
            return;
        };
        // Commit terminal states only after process exit and output verification.
        if let Some(stage @ ("loading" | "separating" | "exporting")) = event["stage"].as_str() {
            job.status.stage = stage.into();
            job.status.progress = event["progress"].as_u64().map(|p| p.min(100) as u8);
        }
        if let Some(device) = event["device"].as_str() {
            job.status.device = Some(device.into());
        }
        if event["stage"] == "error" {
            job.status.message = event["message"].as_str().map(str::to_string);
        }
    }

    pub fn cancel(&self, id: &str) -> Result<(), String> {
        let mut locked = self.0.lock().map_err(|e| e.to_string())?;
        let job = locked
            .as_mut()
            .filter(|job| job.status.id == id)
            .ok_or_else(|| "分离任务不存在。".to_string())?;
        if let Some(child) = job.child.as_mut() {
            child.lock().map_err(|e| e.to_string())?.kill().map_err(|e| e.to_string())?;
            job.cancelled = true;
            job.status.stage = "cancelling".into();
        }
        Ok(())
    }

    pub fn shutdown(&self) {
        self.finish_batch();
        if let Ok(mut locked) = self.0.lock() {
            if let Some(job) = locked.as_mut() {
                if let Some(child) = job.child.as_mut() {
                    job.cancelled = true;
                    let mut child = child.lock().unwrap();
                    let _ = child.kill();
                    let _ = child.wait();
                    cleanup_outputs(Path::new(&job.status.output_dir));
                }
            }
        }
    }
}

pub(super) fn read_tail(mut reader: impl Read) -> String {
    let mut tail = Vec::new();
    let mut buffer = [0u8; 4096];
    while let Ok(count) = reader.read(&mut buffer) {
        if count == 0 {
            break;
        }
        tail.extend_from_slice(&buffer[..count]);
        if tail.len() > 8192 {
            tail.drain(..tail.len() - 8192);
        }
    }
    String::from_utf8_lossy(&tail).into_owned()
}

pub(super) fn valid_wav(path: &Path) -> bool {
    let Ok(mut file) = fs::File::open(path) else {
        return false;
    };
    let mut header = [0u8; 12];
    file.metadata().is_ok_and(|metadata| metadata.len() > 44)
        && file.read_exact(&mut header).is_ok()
        && &header[..4] == b"RIFF"
        && &header[8..] == b"WAVE"
}

fn cleanup_outputs(output: &Path) {
    // Remove only our known files and the now-empty unique task directory.
    for name in ["vocals.wav", "accompaniment.wav"] {
        let _ = fs::remove_file(output.join(name));
    }
    let _ = fs::remove_dir(output);
}

#[cfg(test)]
mod tests {
    use std::time::Duration;
    use super::*;

    #[test]
    fn rejects_arbitrary_engine_or_model() {
        for (engine, model, device) in [
            ("shell", "htdemucs_6s", "cpu"),
            ("demucs", "../model", "cpu"),
            ("demucs", "htdemucs_6s", "bad"),
        ] {
            assert!(SeparationPlan {
                engine: engine.into(),
                model: model.into(),
                device: device.into()
            }
            .validate()
            .is_err());
        }
    }

    #[test]
    fn preserves_unrelated_files_when_cleaning_partial_exports() {
        let dir = std::env::temp_dir().join(format!("mono-stem-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&dir).unwrap();
        fs::write(dir.join("vocals.wav"), b"partial").unwrap();
        fs::write(dir.join("keep.txt"), b"keep").unwrap();
        cleanup_outputs(&dir);
        assert!(!dir.join("vocals.wav").exists());
        assert!(dir.join("keep.txt").exists());
        fs::remove_file(dir.join("keep.txt")).unwrap();
        fs::remove_dir(dir).unwrap();
    }

    #[test]
    fn diagnostics_are_bounded() {
        assert_eq!(read_tail(&vec![b'x'; 100_000][..]).len(), 8192);
    }

    #[test]
    fn rejects_invalid_audio_exports() {
        let path =
            std::env::temp_dir().join(format!("mono-stem-invalid-{}.wav", uuid::Uuid::new_v4()));
        fs::write(&path, [0u8; 128]).unwrap();
        assert!(!valid_wav(&path));
        fs::write(&path, b"RIFF\0\0\0\0WAVE").unwrap();
        assert!(!valid_wav(&path));
        fs::remove_file(path).unwrap();
    }

    #[test]
    #[ignore = "Requires MONO_STEM_TEST_PYTHON pointing to a prepared Demucs environment; downloads model on first run"]
    fn real_demucs_exports_cancels_and_restarts() {
        let python = std::env::var("MONO_STEM_TEST_PYTHON").expect("set MONO_STEM_TEST_PYTHON");
        let root = std::env::temp_dir().join(format!("mono stems 测试-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let source = root.join("测试 音乐.wav");
        let samples: Vec<i16> = (0..88200)
            .map(|i| (4000.0 * (i as f64 * 440.0 * std::f64::consts::TAU / 44100.0).sin()) as i16)
            .collect();
        let length = (samples.len() * 2) as u32;
        let mut wav = Vec::new();
        wav.extend(b"RIFF");
        wav.extend((36 + length).to_le_bytes());
        wav.extend(b"WAVEfmt ");
        wav.extend(16u32.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(44100u32.to_le_bytes());
        wav.extend(88200u32.to_le_bytes());
        wav.extend(2u16.to_le_bytes());
        wav.extend(16u16.to_le_bytes());
        wav.extend(b"data");
        wav.extend(length.to_le_bytes());
        for sample in samples {
            wav.extend(sample.to_le_bytes());
        }
        fs::write(&source, wav).unwrap();
        let cache = std::env::var("MONO_STEM_TEST_CACHE")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir().join("mono-demucs-test-cache"));
        let state = SeparationState::default();
        let plan = || SeparationPlan {
            engine: "demucs".into(),
            model: "htdemucs_6s".into(),
            device: "cpu".into(),
        };
        let first = state
            .start("test".into(), &python, plan(), &source, &root, &cache)
            .unwrap();
        assert!(state
            .start("test".into(), &python, plan(), &source, &root, &cache)
            .is_err());
        assert!(state.cancel("another-job").is_err());
        state.cancel(&first.id).unwrap();
        let wait = || {
            let deadline = std::time::Instant::now() + Duration::from_secs(600);
            loop {
                let status = state.status().unwrap().unwrap();
                if !status.is_running() {
                    break status;
                }
                if std::time::Instant::now() > deadline {
                    state.shutdown();
                    panic!("separation timed out");
                }
                thread::sleep(Duration::from_millis(100));
            }
        };
        assert_eq!(wait().stage, "cancelled");
        assert!(!Path::new(&first.output_dir).exists());
        let second = state
            .start("test".into(), &python, plan(), &source, &root, &cache)
            .unwrap();
        let result = wait();
        assert_eq!(result.stage, "done", "{:?}", result.message);
        for path in [
            result.vocals_path.unwrap(),
            result.accompaniment_path.unwrap(),
        ] {
            let audio = fs::read(path).unwrap();
            assert_eq!(&audio[..4], b"RIFF");
            assert_eq!(&audio[8..12], b"WAVE");
            assert!(audio.len() >= 88200 * 2 * 2);
        }
        assert!(source.is_file());
        cleanup_outputs(Path::new(&second.output_dir));
        fs::remove_file(source).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
