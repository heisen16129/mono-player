use super::{
    environment_process::{download_uv, hidden_command, run_command, stop_child},
    SeparationState,
};
use crate::store;
use serde::Serialize;
use serde_json::json;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Child,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager};

const CHECK: &str = include_str!("../../../plugins/stem-separation/check_environment.py");
const REQUIREMENTS: &str = include_str!("../../../plugins/stem-separation/requirements.txt");

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentStatus {
    pub stage: String,
    pub message: String,
    pub python_path: Option<String>,
}

impl Default for EnvironmentStatus {
    fn default() -> Self {
        Self {
            stage: "idle".into(),
            message: "正在检查本地环境…".into(),
            python_path: None,
        }
    }
}

impl EnvironmentStatus {
    fn busy(&self) -> bool {
        matches!(
            self.stage.as_str(),
            "checking" | "installing" | "cancelling"
        )
    }
}

#[derive(Default)]
pub(super) struct EnvironmentInner {
    status: Mutex<EnvironmentStatus>,
    pub child: Mutex<Option<Child>>,
    cancelled: AtomicBool,
}

#[derive(Clone, Default)]
pub(crate) struct EnvironmentState(pub(super) Arc<EnvironmentInner>);

impl EnvironmentState {
    pub fn status(&self) -> EnvironmentStatus {
        self.0.status.lock().unwrap().clone()
    }

    pub(super) fn while_idle<T>(
        &self,
        action: impl FnOnce() -> Result<T, String>,
    ) -> Result<T, String> {
        let status = self.0.status.lock().unwrap();
        if status.busy() {
            return Err("运行环境正在准备中，请稍候。".into());
        }
        action()
    }

    pub(super) fn check_cancelled(&self) -> Result<(), String> {
        if self.0.cancelled.load(Ordering::SeqCst) {
            Err("已取消准备。".into())
        } else {
            Ok(())
        }
    }

    pub(super) fn message(&self, message: &str) {
        let mut status = self.0.status.lock().unwrap();
        if status.stage != "cancelling" {
            status.message = message.into();
        }
    }

    pub(super) fn begin(
        &self,
        app: AppHandle,
        plugin_id: String,
        install: bool,
    ) -> Result<EnvironmentStatus, String> {
        super::installed_plugin(&app, &plugin_id)?;
        let configured = store::read_plugin_config_value(&app, &plugin_id)
            .map_err(|e| e.to_string())?
            .and_then(|v| v["pythonPath"].as_str().map(str::to_string));
        let root = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("stem-separation");
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|e| e.to_string())?
            .join("demucs");
        let mut current = self.0.status.lock().unwrap();
        if current.busy() {
            return Ok(current.clone());
        }
        if install && app.state::<super::BatchState>().running() {
            return Err("请等待文件夹分离完成，再准备运行环境。".into());
        }
        if install
            && app
                .state::<SeparationState>()
                .status()?
                .is_some_and(|s| s.is_running())
        {
            return Err("请等待当前分离任务完成，再准备运行环境。".into());
        }
        *current = EnvironmentStatus {
            stage: if install { "installing" } else { "checking" }.into(),
            ..EnvironmentStatus::default()
        };
        self.0.cancelled.store(false, Ordering::SeqCst);
        let snapshot = current.clone();
        drop(current);
        let state = self.clone();
        thread::spawn(move || {
            let result = state
                .prepare(&root, &cache, configured.as_deref(), install)
                .and_then(|python| {
                    if let Some(python) = &python {
                        state.check_cancelled()?;
                        super::installed_plugin(&app, &plugin_id)?;
                        let mut config = store::read_plugin_config_value(&app, &plugin_id)
                            .map_err(|e| e.to_string())?
                            .unwrap_or(json!({}));
                        if !config.is_object() {
                            config = json!({});
                        }
                        config["pythonPath"] = json!(python);
                        let saved = store::plugin_config_set(app.clone(), plugin_id, config);
                        if saved.code != 1 {
                            return Err(saved.message);
                        }
                    }
                    Ok(python)
                });
            let mut current = state.0.status.lock().unwrap();
            *current = if state.check_cancelled().is_err() {
                EnvironmentStatus {
                    stage: "cancelled".into(),
                    message: "已取消准备，可以稍后继续。".into(),
                    python_path: None,
                }
            } else {
                match result {
                    Ok(Some(python)) => EnvironmentStatus {
                        stage: "ready".into(),
                        message: "本地环境已就绪".into(),
                        python_path: Some(python.to_string_lossy().into_owned()),
                    },
                    Ok(None) => EnvironmentStatus {
                        stage: "missing".into(),
                        message: "首次使用需要准备分离组件".into(),
                        python_path: None,
                    },
                    Err(error) => EnvironmentStatus {
                        stage: "error".into(),
                        message: format!("准备未完成，请检查网络后重试。\n{error}"),
                        python_path: None,
                    },
                }
            };
        });
        Ok(snapshot)
    }

    fn probe(&self, python: &Path) -> bool {
        let mut command = hidden_command(python);
        command.args(["-I", "-u", "-c", CHECK]);
        run_command(self, command, Duration::from_secs(90)).is_ok()
    }

    fn prepare(
        &self,
        root: &Path,
        cache: &Path,
        configured: Option<&str>,
        install: bool,
    ) -> Result<Option<PathBuf>, String> {
        for candidate in candidates(root, configured) {
            self.check_cancelled()?;
            if self.probe(&candidate) {
                return Ok(Some(candidate));
            }
        }
        self.check_cancelled()?;
        if !install {
            return Ok(None);
        }
        self.install_managed(root, cache).map(Some)
    }

    fn install_managed(&self, root: &Path, cache: &Path) -> Result<PathBuf, String> {
        fs::create_dir_all(root).map_err(|e| e.to_string())?;
        let uv = download_uv(self, root)?;
        let python = python_path(root);
        let uv_command = || {
            let mut command = hidden_command(&uv);
            command
                .env("UV_PYTHON_INSTALL_DIR", root.join("python"))
                .env("UV_CACHE_DIR", root.join("cache"))
                .env("UV_NO_PROGRESS", "1")
                .env("UV_LINK_MODE", "copy");
            command
        };
        self.message("正在准备独立运行环境…");
        if !python.is_file() {
            let mut create = uv_command();
            create
                .args(["venv", "--managed-python", "--python", "3.12"])
                .arg(root.join("venv"));
            run_command(self, create, Duration::from_secs(1800))?;
        }
        self.message("正在下载并安装分离引擎，首次准备可能需要几分钟…");
        let mut torch = uv_command();
        torch
            .args(["pip", "install", "--python"])
            .arg(&python)
            .args(["torch==2.5.1", "torchaudio==2.5.1"]);
        if !cfg!(target_os = "macos") {
            torch.args(["--index-url", "https://download.pytorch.org/whl/cpu"]);
        }
        run_command(self, torch, Duration::from_secs(1800))?;
        self.message("正在安装音频组件…");
        let requirements = root.join("requirements.txt");
        fs::write(&requirements, REQUIREMENTS).map_err(|e| e.to_string())?;
        let mut dependencies = uv_command();
        dependencies
            .args(["pip", "install", "--python"])
            .arg(&python)
            .arg("-r")
            .arg(&requirements);
        run_command(self, dependencies, Duration::from_secs(1800))?;
        self.message("正在准备分离模型…");
        let mut model = hidden_command(&python);
        model.args(["-I", "-u", "-c", CHECK]).arg(cache);
        run_command(self, model, Duration::from_secs(900))?;
        Ok(python)
    }

    pub fn cancel(&self) {
        let mut current = self.0.status.lock().unwrap();
        if current.busy() {
            self.0.cancelled.store(true, Ordering::SeqCst);
            current.stage = "cancelling".into();
            current.message = "正在取消准备…".into();
        }
    }

    pub fn shutdown(&self) {
        self.cancel();
        if let Some(child) = self.0.child.lock().unwrap().as_mut() {
            stop_child(child);
        }
    }
}

fn python_path(root: &Path) -> PathBuf {
    root.join(if cfg!(windows) {
        "venv/Scripts/python.exe"
    } else {
        "venv/bin/python"
    })
}

fn candidates(root: &Path, configured: Option<&str>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(path) = configured
        .map(str::trim)
        .filter(|p| !p.is_empty() && *p != "python")
    {
        paths.push(PathBuf::from(path));
    }
    paths.push(python_path(root));
    if cfg!(windows) {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("MonoDemucs/Scripts/python.exe"));
        }
    }
    // Probe explicit files only: opening a Store alias can launch an unexpected UI.
    paths.retain(|p| p.is_file());
    paths.dedup();
    paths
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preparation_blocks_separation_and_can_be_cancelled() {
        let state = EnvironmentState::default();
        state.0.status.lock().unwrap().stage = "installing".into();
        assert!(state.while_idle(|| Ok(())).is_err());
        state.cancel();
        assert_eq!(state.status().stage, "cancelling");
        assert!(state.check_cancelled().is_err());
        state.0.status.lock().unwrap().stage = "cancelled".into();
        assert!(state.while_idle(|| Ok(())).is_ok());
    }

    #[test]
    #[cfg(windows)]
    fn cancellation_stops_running_installer() {
        let state = EnvironmentState::default();
        state.0.status.lock().unwrap().stage = "installing".into();
        let runner = state.clone();
        let task = thread::spawn(move || {
            let mut command = hidden_command("powershell.exe");
            command.args(["-NoProfile", "-Command", "Start-Sleep -Seconds 60"]);
            run_command(&runner, command, Duration::from_secs(10))
        });
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while state.0.child.lock().unwrap().is_none() {
            assert!(std::time::Instant::now() < deadline);
            thread::sleep(Duration::from_millis(20));
        }
        state.cancel();
        assert!(task.join().unwrap().is_err());
        assert!(state.0.child.lock().unwrap().is_none());
    }

    #[test]
    #[ignore = "Requires MONO_STEM_TEST_PYTHON; checks an existing environment without installing anything"]
    fn reuses_existing_environment_without_installation() {
        let python = std::env::var("MONO_STEM_TEST_PYTHON").unwrap();
        let root = std::env::temp_dir().join(format!("mono-setup-reuse-{}", uuid::Uuid::new_v4()));
        let state = EnvironmentState::default();
        let detected = state
            .prepare(&root, &root.join("models"), Some(&python), false)
            .unwrap()
            .unwrap();
        assert_eq!(detected, PathBuf::from(python));
        assert!(
            !root.exists(),
            "read-only detection must not install anything"
        );
    }

    #[test]
    #[ignore = "Downloads Python, dependencies and model into MONO_STEM_SETUP_TEST_DIR"]
    fn installs_managed_environment_from_scratch() {
        let root = PathBuf::from(std::env::var("MONO_STEM_SETUP_TEST_DIR").unwrap());
        let state = EnvironmentState::default();
        state.0.status.lock().unwrap().stage = "installing".into();
        let python = state.install_managed(&root, &root.join("models")).unwrap();
        assert!(state.probe(&python));
        assert!(root.join("models/hub/checkpoints").is_dir());
        // A subsequent check must reuse this environment without running the installer.
        assert_eq!(
            state
                .prepare(&root, &root.join("models"), None, false)
                .unwrap(),
            Some(python)
        );
    }
}
