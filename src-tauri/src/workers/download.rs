use crate::{
    downloads::{
        download_online_track_blocking_with_progress, DownloadQueueEvent,
        ResolvedDownloadTrackRequest,
    },
    workers::lifecycle::{RestartPolicy, WorkerChild},
    workers::manager::{WorkerProcess, WorkerProcessParts},
    workers::protocol::{decode_request, encode_line, methods, WorkerMessage, WorkerRequest},
    workers::DOWNLOAD_WORKER_FLAG,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{self, BufRead, Write};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use tauri::Emitter;

pub(crate) struct DownloadWorkerState {
    stdin: Arc<Mutex<std::process::ChildStdin>>,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<WorkerMessage>>>>,
    child: WorkerChild,
}

impl DownloadWorkerState {
    pub(crate) fn start(app: tauri::AppHandle) -> Result<Self, String> {
        let parts = start_download_worker_parts()?;
        let stdin = Arc::new(Mutex::new(parts.stdin));
        let pending = Arc::new(Mutex::new(HashMap::new()));
        start_download_reader(app, parts.stdout, Arc::clone(&pending));
        let state = Self {
            stdin,
            pending,
            child: WorkerChild::running("download", parts.child),
        };
        state.expect_startup()?;
        Ok(state)
    }

    pub(crate) fn restart_policy(&self) -> RestartPolicy {
        RestartPolicy::RestartBeforeSendOnly
    }

    pub(crate) fn enqueue_download_track(
        &self,
        task_id: String,
        request: ResolvedDownloadTrackRequest,
    ) -> Result<(), String> {
        let worker_request = WorkerRequest {
            id: format!("download-enqueue-{task_id}"),
            method: methods::DOWNLOAD_ENQUEUE.to_string(),
            payload: json!({
                "taskId": task_id,
                "request": request,
            }),
        };

        match self.request(worker_request)? {
            WorkerMessage::Response { ok: true, .. } => Ok(()),
            WorkerMessage::Response {
                error: Some(error), ..
            } => Err(error),
            message => Err(format!("unexpected download worker response: {message:?}")),
        }
    }

    pub(crate) fn health(&self) -> Result<Value, String> {
        match self.request(WorkerRequest {
            id: "download-health".to_string(),
            method: methods::WORKER_HEALTH.to_string(),
            payload: json!({}),
        })? {
            WorkerMessage::Response {
                ok: true,
                payload: Some(payload),
                ..
            } => Ok(payload),
            WorkerMessage::Response {
                error: Some(error), ..
            } => Err(error),
            message => Err(format!("unexpected download worker response: {message:?}")),
        }
    }

    fn expect_startup(&self) -> Result<(), String> {
        let request = WorkerRequest {
            id: "download-worker-startup".to_string(),
            method: methods::WORKER_PING.to_string(),
            payload: json!({ "source": "tauri-setup" }),
        };
        match self.request(request)? {
            WorkerMessage::Response { ok: true, .. } => Ok(()),
            WorkerMessage::Response {
                error: Some(error), ..
            } => Err(error),
            message => Err(format!(
                "unexpected download worker startup response: {message:?}"
            )),
        }
    }

    fn request(&self, request: WorkerRequest) -> Result<WorkerMessage, String> {
        if !self.is_running()? {
            return Err(self
                .child
                .status()
                .error
                .unwrap_or_else(|| "download worker is not running".to_string()));
        }

        let (sender, receiver) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|err| err.to_string())?
            .insert(request.id.clone(), sender);

        let write_result = (|| {
            let line = encode_line(&request)?;
            let mut stdin = self.stdin.lock().map_err(|err| err.to_string())?;
            stdin
                .write_all(line.as_bytes())
                .and_then(|_| stdin.flush())
                .map_err(|err| err.to_string())
        })();

        if let Err(error) = write_result {
            let _ = self
                .pending
                .lock()
                .map_err(|err| err.to_string())?
                .remove(&request.id);
            return Err(error);
        }

        receiver.recv().map_err(|err| err.to_string())
    }

    fn is_running(&self) -> Result<bool, String> {
        self.child.is_running()
    }
}

fn start_download_worker_parts() -> Result<WorkerProcessParts, String> {
    WorkerProcess::spawn_current_exe_parts("download", DOWNLOAD_WORKER_FLAG, &[])
}

fn start_download_reader(
    app: tauri::AppHandle,
    mut stdout: std::io::BufReader<std::process::ChildStdout>,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<WorkerMessage>>>>,
) {
    thread::spawn(move || loop {
        let mut line = String::new();
        let Ok(bytes_read) = stdout.read_line(&mut line) else {
            fail_pending_download_requests(&pending);
            break;
        };
        if bytes_read == 0 {
            fail_pending_download_requests(&pending);
            break;
        }
        let Ok(message) = crate::workers::protocol::decode_message(line.trim_end()) else {
            continue;
        };
        match message {
            WorkerMessage::Response { ref id, .. } => {
                let sender = pending
                    .lock()
                    .ok()
                    .and_then(|mut pending| pending.remove(id));
                if let Some(sender) = sender {
                    let _ = sender.send(message);
                }
            }
            event => emit_worker_event(&app, event),
        }
    });
}

fn fail_pending_download_requests(
    pending: &Arc<Mutex<HashMap<String, mpsc::Sender<WorkerMessage>>>>,
) {
    let Ok(mut pending) = pending.lock() else {
        return;
    };
    for (id, sender) in pending.drain() {
        let _ = sender.send(WorkerMessage::Response {
            id,
            ok: false,
            payload: None,
            error: Some("download worker closed stdout".to_string()),
        });
    }
}

fn emit_worker_event(app: &tauri::AppHandle, message: WorkerMessage) {
    let WorkerMessage::Event { name, payload } = message else {
        return;
    };
    if name != methods::DOWNLOAD_EVENT {
        return;
    }
    if let Ok(event) = serde_json::from_value::<DownloadQueueEvent>(payload) {
        let _ = app.emit("download://event", event);
    }
}

pub(crate) fn run() -> Result<(), String> {
    let stdin = io::stdin();
    let stdout = Arc::new(Mutex::new(io::stdout()));
    let started_at_ms = crate::workers::worker_started_at_ms();
    let queue_sender = start_worker_download_queue(Arc::clone(&stdout));

    for line in stdin.lock().lines() {
        let line = line.map_err(|err| err.to_string())?;
        if line.trim().is_empty() {
            continue;
        }

        let response = match decode_request(&line) {
            Ok(request) => handle_request(&queue_sender, request, started_at_ms)?,
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

        write_shared_message(&stdout, &response)?;

        if should_shutdown {
            break;
        }
    }

    Ok(())
}

fn handle_request(
    queue_sender: &mpsc::Sender<DownloadTrackPayload>,
    request: WorkerRequest,
    started_at_ms: u128,
) -> Result<WorkerMessage, String> {
    match request.method.as_str() {
        methods::WORKER_PING => Ok(WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({ "pong": true, "worker": "download" })),
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
            payload: Some(crate::workers::worker_health_payload(
                "download",
                started_at_ms,
            )),
            error: None,
        }),
        methods::DOWNLOAD_ENQUEUE => {
            let payload = serde_json::from_value::<DownloadTrackPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            queue_sender.send(payload).map_err(|err| err.to_string())?;
            Ok(WorkerMessage::Response {
                id: request.id,
                ok: true,
                payload: Some(json!({ "queued": true })),
                error: None,
            })
        }
        method => Ok(WorkerMessage::Response {
            id: request.id,
            ok: false,
            payload: None,
            error: Some(format!("unsupported download worker method: {method}")),
        }),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadTrackPayload {
    task_id: String,
    request: ResolvedDownloadTrackRequest,
}

fn start_worker_download_queue(
    stdout: Arc<Mutex<io::Stdout>>,
) -> mpsc::Sender<DownloadTrackPayload> {
    let (sender, receiver) = mpsc::channel::<DownloadTrackPayload>();
    thread::spawn(move || {
        for payload in receiver {
            let _ = download_track(&stdout, "download-queued".to_string(), payload);
        }
    });
    sender
}

fn download_track(
    stdout: &Arc<Mutex<io::Stdout>>,
    request_id: String,
    payload: DownloadTrackPayload,
) -> WorkerMessage {
    let mut last_progress = 0;
    let task_id = payload.task_id;
    let _ = write_shared_download_event(stdout, &task_id, "downloading", 0, None, None, None);

    let result = download_online_track_blocking_with_progress(payload.request, |progress| {
        if progress == last_progress {
            return;
        }
        last_progress = progress;
        let _ = write_shared_download_event(
            stdout,
            &task_id,
            "downloading",
            progress,
            None,
            None,
            None,
        );
    });

    match result {
        Ok(result) => {
            let _ = write_shared_download_event(
                stdout,
                &task_id,
                "downloaded",
                100,
                Some(result.file_path.clone()),
                result.lyrics_path.clone(),
                None,
            );
            WorkerMessage::Response {
                id: request_id,
                ok: true,
                payload: Some(json!(result)),
                error: None,
            }
        }
        Err(error) => {
            let _ = write_shared_download_event(
                stdout,
                &task_id,
                "failed",
                last_progress,
                None,
                None,
                Some(error.clone()),
            );
            WorkerMessage::Response {
                id: request_id,
                ok: false,
                payload: None,
                error: Some(error),
            }
        }
    }
}

fn write_download_event<W: Write>(
    stdout: &mut W,
    task_id: &str,
    status: &str,
    progress: u8,
    file_path: Option<String>,
    lyrics_path: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    write_message(
        stdout,
        &WorkerMessage::Event {
            name: methods::DOWNLOAD_EVENT.to_string(),
            payload: json!(DownloadQueueEvent {
                task_id: task_id.to_string(),
                status: status.to_string(),
                progress,
                file_path,
                lyrics_path,
                error,
            }),
        },
    )
}

fn write_shared_download_event(
    stdout: &Arc<Mutex<io::Stdout>>,
    task_id: &str,
    status: &str,
    progress: u8,
    file_path: Option<String>,
    lyrics_path: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    let mut stdout = stdout.lock().map_err(|err| err.to_string())?;
    write_download_event(
        &mut *stdout,
        task_id,
        status,
        progress,
        file_path,
        lyrics_path,
        error,
    )
}

fn write_shared_message(
    stdout: &Arc<Mutex<io::Stdout>>,
    message: &WorkerMessage,
) -> Result<(), String> {
    let mut stdout = stdout.lock().map_err(|err| err.to_string())?;
    write_message(&mut *stdout, message)
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
        let (queue_sender, _queue_receiver) = mpsc::channel::<DownloadTrackPayload>();
        let response = handle_request(
            &queue_sender,
            WorkerRequest {
                id: "ping-1".to_string(),
                method: methods::WORKER_PING.to_string(),
                payload: json!({}),
            },
            1,
        )
        .expect("ping should be handled");

        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "ping-1".to_string(),
                ok: true,
                payload: Some(json!({ "pong": true, "worker": "download" })),
                error: None,
            }
        );
    }
}
