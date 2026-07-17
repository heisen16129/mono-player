use crate::{
    models::Track,
    workers::{
        lifecycle::{RestartPolicy, WorkerRuntimeStatus},
        manager::WorkerProcess,
        protocol::{decode_request, encode_line, methods, WorkerMessage, WorkerRequest},
        SCAN_WORKER_FLAG,
    },
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    io::{self, BufRead, Write},
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

#[derive(Clone, Default)]
pub(crate) struct ScanWorkerState {
    inner: Arc<ScanWorkerInner>,
}

#[derive(Default)]
struct ScanWorkerInner {
    current_task: Mutex<Option<ScanTaskHandle>>,
    cancel_requested: AtomicBool,
}

#[derive(Clone)]
struct ScanTaskHandle {
    pid: u32,
    started_at_ms: u128,
}

impl ScanTaskHandle {
    fn new(pid: u32) -> Self {
        Self {
            pid,
            started_at_ms: crate::workers::worker_started_at_ms(),
        }
    }

    fn status(&self) -> WorkerRuntimeStatus {
        WorkerRuntimeStatus::running("scan", Some(self.pid), Some(self.started_at_ms))
    }

    fn kill(&self) -> Result<(), String> {
        kill_process_tree(self.pid)
    }
}

impl ScanWorkerState {
    pub(crate) fn restart_policy(&self) -> RestartPolicy {
        RestartPolicy::PerTask
    }

    pub(crate) fn run_scan<F>(&self, path: String, mut on_track: F) -> Result<(), String>
    where
        F: FnMut(Track) -> Result<(), String>,
    {
        self.inner.cancel_requested.store(false, Ordering::SeqCst);
        let mut worker = WorkerProcess::spawn_current_exe("scan", SCAN_WORKER_FLAG, &[])?;
        let pid = worker.id();
        self.register_current_task(ScanTaskHandle::new(pid))?;
        let result = run_scan_with_worker(&mut worker, path, |track| {
            if self.inner.cancel_requested.load(Ordering::SeqCst) {
                return Err("Scan canceled.".to_string());
            }
            on_track(track)
        });
        self.clear_current_task(pid);

        match result {
            Err(_) if self.inner.cancel_requested.load(Ordering::SeqCst) => {
                self.inner.cancel_requested.store(false, Ordering::SeqCst);
                Err("Scan canceled.".to_string())
            }
            result => result,
        }
    }

    pub(crate) fn cancel(&self) -> Result<bool, String> {
        self.inner.cancel_requested.store(true, Ordering::SeqCst);
        let task = self
            .inner
            .current_task
            .lock()
            .map_err(|err| err.to_string())?
            .clone();
        let Some(task) = task else {
            return Ok(false);
        };
        task.kill()?;
        Ok(true)
    }

    pub(crate) fn status(&self) -> WorkerRuntimeStatus {
        match self.inner.current_task.lock() {
            Ok(task) => task
                .as_ref()
                .map(ScanTaskHandle::status)
                .unwrap_or_else(|| WorkerRuntimeStatus::stopped("scan", None)),
            Err(error) => WorkerRuntimeStatus::stopped("scan", Some(error.to_string())),
        }
    }

    fn register_current_task(&self, task: ScanTaskHandle) -> Result<(), String> {
        let mut current = self
            .inner
            .current_task
            .lock()
            .map_err(|err| err.to_string())?;
        if current.is_some() {
            self.inner.cancel_requested.store(false, Ordering::SeqCst);
            return Err("A music scan is already running.".to_string());
        }
        *current = Some(task);
        Ok(())
    }

    fn clear_current_task(&self, pid: u32) {
        if let Ok(mut current) = self.inner.current_task.lock() {
            if current.as_ref().map(|task| task.pid) == Some(pid) {
                *current = None;
            }
        }
    }
}

fn run_scan_with_worker<F>(
    worker: &mut WorkerProcess,
    path: String,
    mut on_track: F,
) -> Result<(), String>
where
    F: FnMut(Track) -> Result<(), String>,
{
    let request = WorkerRequest {
        id: "scan-music-dir".to_string(),
        method: methods::SCAN_MUSIC_DIR.to_string(),
        payload: json!({ "path": path }),
    };

    match worker.request_until_response(&request, |message| {
        let WorkerMessage::Event { name, payload } = message else {
            return Ok(());
        };
        if name != methods::SCAN_TRACK {
            return Ok(());
        }
        let track = serde_json::from_value::<Track>(payload).map_err(|err| err.to_string())?;
        on_track(track)
    })? {
        WorkerMessage::Response { ok: true, .. } => Ok(()),
        WorkerMessage::Response {
            error: Some(error), ..
        } => Err(error),
        message => Err(format!("unexpected scan worker response: {message:?}")),
    }
}

fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .map_err(|err| err.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("failed to cancel scan worker pid {pid}"))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status()
            .map_err(|err| err.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("failed to cancel scan worker pid {pid}"))
        }
    }
}

pub(crate) fn run() -> Result<(), String> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let started_at_ms = crate::workers::worker_started_at_ms();

    for line in stdin.lock().lines() {
        let line = line.map_err(|err| err.to_string())?;
        if line.trim().is_empty() {
            continue;
        }

        let response = match decode_request(&line) {
            Ok(request) => handle_request(&mut stdout, request, started_at_ms)?,
            Err(error) => WorkerMessage::Response {
                id: "invalid-request".to_string(),
                ok: false,
                payload: None,
                error: Some(error),
            },
        };
        let should_shutdown = matches!(
            &response,
            WorkerMessage::Response {
                ok: true,
                payload: Some(payload),
                ..
            } if payload.get("shutdown").and_then(Value::as_bool) == Some(true)
        );

        write_message(&mut stdout, &response)?;

        if should_shutdown {
            break;
        }
    }

    Ok(())
}

fn handle_request<W: Write>(
    stdout: &mut W,
    request: WorkerRequest,
    started_at_ms: u128,
) -> Result<WorkerMessage, String> {
    match request.method.as_str() {
        methods::WORKER_PING => Ok(WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({ "pong": true, "worker": "scan" })),
            error: None,
        }),
        methods::WORKER_SHUTDOWN => Ok(WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({ "shutdown": true })),
            error: None,
        }),
        methods::WORKER_HEALTH => Ok(WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(crate::workers::worker_health_payload("scan", started_at_ms)),
            error: None,
        }),
        methods::SCAN_MUSIC_DIR => {
            let payload = serde_json::from_value::<ScanMusicDirPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            Ok(scan_music_dir(stdout, request.id, payload))
        }
        method => Ok(WorkerMessage::Response {
            id: request.id,
            ok: false,
            payload: None,
            error: Some(format!("unsupported scan worker method: {method}")),
        }),
    }
}

#[derive(Deserialize)]
struct ScanMusicDirPayload {
    path: String,
}

fn scan_music_dir<W: Write>(
    stdout: &mut W,
    request_id: String,
    payload: ScanMusicDirPayload,
) -> WorkerMessage {
    let root = PathBuf::from(payload.path);
    if !root.is_dir() {
        return WorkerMessage::Response {
            id: request_id,
            ok: false,
            payload: None,
            error: Some("Music directory does not exist or is not a folder.".to_string()),
        };
    }

    let result = crate::scanner::scan_music_dir_entries(&root, |track| {
        write_message(
            stdout,
            &WorkerMessage::Event {
                name: methods::SCAN_TRACK.to_string(),
                payload: json!(track),
            },
        )
    });

    match result {
        Ok(count) => WorkerMessage::Response {
            id: request_id,
            ok: true,
            payload: Some(json!({ "tracks": count })),
            error: None,
        },
        Err(error) => WorkerMessage::Response {
            id: request_id,
            ok: false,
            payload: None,
            error: Some(error),
        },
    }
}

fn write_message<W: Write>(stdout: &mut W, message: &WorkerMessage) -> Result<(), String> {
    let encoded = encode_line(message)?;
    stdout
        .write_all(encoded.as_bytes())
        .and_then(|_| stdout.flush())
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_ping_request() {
        let mut output = Vec::new();
        let response = handle_request(
            &mut output,
            WorkerRequest {
                id: "ping-1".to_string(),
                method: methods::WORKER_PING.to_string(),
                payload: json!({}),
            },
            1,
        )
        .expect("ping should be handled");

        assert!(output.is_empty());
        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "ping-1".to_string(),
                ok: true,
                payload: Some(json!({ "pong": true, "worker": "scan" })),
                error: None,
            }
        );
    }

    #[test]
    fn cancel_without_running_scan_returns_false() {
        let state = ScanWorkerState::default();

        let canceled = state.cancel().expect("idle cancel should not fail");

        assert!(!canceled);
    }
}
