use crate::{
    api_response::ApiResponse,
    workers::{lifecycle::WorkerRuntimeStatus, mcp_api::McpApiWorkerState},
};
use serde::Serialize;
use tauri::State;

const MCP_ENDPOINT: &str = "http://127.0.0.1:17331/mcp";
const MCP_HEALTH_ENDPOINT: &str = "http://127.0.0.1:17331/health";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpServiceSnapshot {
    worker: String,
    running: bool,
    pid: Option<u32>,
    started_at_ms: Option<u128>,
    error: Option<String>,
    restart_policy: Option<&'static str>,
    endpoint: &'static str,
    health_endpoint: &'static str,
}

#[tauri::command]
pub(crate) fn mcp_service_status(
    mcp_api: State<'_, McpApiWorkerState>,
) -> ApiResponse<McpServiceSnapshot> {
    ApiResponse::success(snapshot_from_status(mcp_api.status()))
}

#[tauri::command]
pub(crate) fn mcp_service_start(
    mcp_api: State<'_, McpApiWorkerState>,
) -> ApiResponse<McpServiceSnapshot> {
    ApiResponse::from_result(mcp_api.start_worker().map(snapshot_from_status))
}

#[tauri::command]
pub(crate) fn mcp_service_stop(
    mcp_api: State<'_, McpApiWorkerState>,
) -> ApiResponse<McpServiceSnapshot> {
    ApiResponse::from_result(mcp_api.stop_worker().map(snapshot_from_status))
}

#[tauri::command]
pub(crate) fn mcp_service_restart(
    mcp_api: State<'_, McpApiWorkerState>,
) -> ApiResponse<McpServiceSnapshot> {
    ApiResponse::from_result(mcp_api.restart_worker().map(snapshot_from_status))
}

fn snapshot_from_status(status: WorkerRuntimeStatus) -> McpServiceSnapshot {
    McpServiceSnapshot {
        worker: status.worker,
        running: status.running,
        pid: status.pid,
        started_at_ms: status.started_at_ms,
        error: status.error,
        restart_policy: status.restart_policy,
        endpoint: MCP_ENDPOINT,
        health_endpoint: MCP_HEALTH_ENDPOINT,
    }
}
