pub(crate) mod lifecycle;
pub(crate) mod manager;
pub(crate) mod protocol;

pub(crate) mod audio;
pub(crate) mod download;
pub(crate) mod mcp_api;
pub(crate) mod plugin;
pub(crate) mod scanner;

use serde_json::{json, Value};
use std::{
    env, process,
    time::{SystemTime, UNIX_EPOCH},
};

const SCAN_WORKER_FLAG: &str = "--mono-scan-worker";
pub(crate) const AUDIO_WORKER_FLAG: &str = "--mono-audio-worker";
pub(crate) const DOWNLOAD_WORKER_FLAG: &str = "--mono-download-worker";
pub(crate) const PLUGIN_WORKER_FLAG: &str = "--mono-plugin-worker";
pub(crate) const MCP_API_WORKER_FLAG: &str = "--mono-mcp-api-worker";
pub(crate) const MCP_HTTP_SERVER_FLAG: &str = "--mono-mcp-http-server";

pub fn run_worker_from_args() -> Result<bool, String> {
    let mut args = env::args().skip(1);
    match args.next().as_deref() {
        Some(AUDIO_WORKER_FLAG) => {
            let cache_dir = args.next().unwrap_or_default();
            audio::run(cache_dir)?;
            Ok(true)
        }
        Some(DOWNLOAD_WORKER_FLAG) => {
            download::run()?;
            Ok(true)
        }
        Some(PLUGIN_WORKER_FLAG) => {
            plugin::run()?;
            Ok(true)
        }
        Some(MCP_API_WORKER_FLAG) => {
            crate::mcp::run_http(args.collect())?;
            Ok(true)
        }
        Some(MCP_HTTP_SERVER_FLAG) => {
            crate::mcp::run_http(args.collect())?;
            Ok(true)
        }
        Some("--mono-mcp-server") => Err(
            "stdio MCP server has been removed. Use the auto-started HTTP MCP endpoint at http://127.0.0.1:17331/mcp, or start --mono-mcp-http-server."
                .to_string(),
        ),
        Some(SCAN_WORKER_FLAG) => {
            scanner::run()?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

pub(crate) fn run_scan_worker<F>(
    scan_worker: &scanner::ScanWorkerState,
    path: String,
    on_track: F,
) -> Result<(), String>
where
    F: FnMut(crate::models::Track) -> Result<(), String>,
{
    scan_worker.run_scan(path, on_track)
}

pub(crate) fn worker_started_at_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

pub(crate) fn worker_health_payload(worker: &str, started_at_ms: u128) -> Value {
    json!({
        "worker": worker,
        "pid": process::id(),
        "startedAtMs": started_at_ms,
    })
}
