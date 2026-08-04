use crate::workers::{
    lifecycle::{RestartPolicy, WorkerChild, WorkerRuntimeStatus},
    MCP_API_WORKER_FLAG,
};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};

pub(crate) struct McpApiWorkerState {
    bridge_file: PathBuf,
    child: Mutex<WorkerChild>,
    host: String,
    port: u16,
    token: Option<String>,
}

impl McpApiWorkerState {
    pub(crate) fn restart_policy(&self) -> RestartPolicy {
        RestartPolicy::NoRestart
    }

    pub(crate) fn start(
        bridge_file: PathBuf,
        host: String,
        port: u16,
        token: Option<String>,
    ) -> Result<Self, String> {
        let child = spawn_mcp_api_worker(&bridge_file, &host, port, token.as_deref())?;

        Ok(Self {
            bridge_file,
            child: Mutex::new(WorkerChild::running("mcp-api", child)),
            host,
            port,
            token,
        })
    }

    pub(crate) fn disabled(
        bridge_file: PathBuf,
        host: String,
        port: u16,
        token: Option<String>,
        error: Option<String>,
    ) -> Self {
        Self {
            bridge_file,
            child: Mutex::new(WorkerChild::disabled("mcp-api", error)),
            host,
            port,
            token,
        }
    }

    pub(crate) fn health(&self) -> Result<Value, String> {
        self.health_payload()
    }

    pub(crate) fn status(&self) -> WorkerRuntimeStatus {
        self.child
            .lock()
            .map(|child| child.status())
            .unwrap_or_else(|err| WorkerRuntimeStatus::stopped("mcp-api", Some(err.to_string())))
    }

    pub(crate) fn start_worker(&self) -> Result<WorkerRuntimeStatus, String> {
        let mut child = self.child.lock().map_err(|err| err.to_string())?;
        if child.is_running()? {
            return Ok(child.status());
        }

        let worker = spawn_mcp_api_worker(
            &self.bridge_file,
            &self.host,
            self.port,
            self.token.as_deref(),
        )?;
        *child = WorkerChild::running("mcp-api", worker);
        Ok(child.status())
    }

    pub(crate) fn stop_worker(&self) -> Result<WorkerRuntimeStatus, String> {
        let mut child = self.child.lock().map_err(|err| err.to_string())?;
        child.stop();
        *child = WorkerChild::disabled("mcp-api", None);
        Ok(child.status())
    }

    pub(crate) fn restart_worker(&self) -> Result<WorkerRuntimeStatus, String> {
        let mut child = self.child.lock().map_err(|err| err.to_string())?;
        child.stop();
        let worker = spawn_mcp_api_worker(
            &self.bridge_file,
            &self.host,
            self.port,
            self.token.as_deref(),
        )?;
        *child = WorkerChild::running("mcp-api", worker);
        Ok(child.status())
    }

    fn health_payload(&self) -> Result<Value, String> {
        let child = self.child.lock().map_err(|err| err.to_string())?;
        if !child.is_running()? {
            let status = child.status();
            return Err(status
                .error
                .unwrap_or_else(|| "mcp api worker is disabled".to_string()));
        }

        Ok(json!({
            "worker": "mcp-api",
            "pid": child.pid()?,
            "startedAtMs": child.status().started_at_ms,
        }))
    }
}

fn spawn_mcp_api_worker(
    bridge_file: &PathBuf,
    host: &str,
    port: u16,
    token: Option<&str>,
) -> Result<std::process::Child, String> {
    let mut args = vec![
        MCP_API_WORKER_FLAG.to_string(),
        "--bridge".to_string(),
        bridge_file.to_string_lossy().to_string(),
        "--host".to_string(),
        host.to_string(),
        "--port".to_string(),
        port.to_string(),
    ];
    if let Some(token) = token {
        args.push("--token".to_string());
        args.push(token.to_string());
    }

    let exe = std::env::current_exe().map_err(|err| err.to_string())?;
    let mut child = Command::new(exe)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| err.to_string())?;

    thread::sleep(Duration::from_millis(120));
    if let Some(status) = child.try_wait().map_err(|err| err.to_string())? {
        return Err(format!("mcp api worker exited during startup: {status}"));
    }

    Ok(child)
}
