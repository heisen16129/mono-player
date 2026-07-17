use crate::workers::{
    lifecycle::{RestartPolicy, WorkerChild, WorkerRuntimeStatus},
    MCP_API_WORKER_FLAG,
};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::Duration,
};

pub(crate) struct McpApiWorkerState {
    child: WorkerChild,
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
        let mut args = vec![
            MCP_API_WORKER_FLAG.to_string(),
            "--bridge".to_string(),
            bridge_file.to_string_lossy().to_string(),
            "--host".to_string(),
            host,
            "--port".to_string(),
            port.to_string(),
        ];
        if let Some(token) = token {
            args.push("--token".to_string());
            args.push(token);
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

        Ok(Self {
            child: WorkerChild::running("mcp-api", child),
        })
    }

    pub(crate) fn disabled(error: Option<String>) -> Self {
        Self {
            child: WorkerChild::disabled("mcp-api", error),
        }
    }

    pub(crate) fn health(&self) -> Result<Value, String> {
        self.health_payload()
    }

    pub(crate) fn status(&self) -> WorkerRuntimeStatus {
        self.child.status()
    }

    fn health_payload(&self) -> Result<Value, String> {
        if !self.child.is_running()? {
            let status = self.child.status();
            return Err(status
                .error
                .unwrap_or_else(|| "mcp api worker is disabled".to_string()));
        }

        Ok(json!({
            "worker": "mcp-api",
            "pid": self.child.pid()?,
            "startedAtMs": self.child.status().started_at_ms,
        }))
    }
}
