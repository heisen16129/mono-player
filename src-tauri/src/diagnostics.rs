use crate::workers::lifecycle::WorkerRuntimeStatus;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkerDiagnosticsSnapshot {
    workers: Vec<WorkerRuntimeStatus>,
}

#[tauri::command]
pub(crate) fn system_worker_health(
    audio: State<'_, crate::workers::audio::AudioWorkerState>,
    download: State<'_, crate::workers::download::DownloadWorkerState>,
    plugin: State<'_, crate::workers::plugin::PluginWorkerState>,
    mcp_api: State<'_, crate::workers::mcp_api::McpApiWorkerState>,
    scan: State<'_, crate::workers::scanner::ScanWorkerState>,
) -> WorkerDiagnosticsSnapshot {
    WorkerDiagnosticsSnapshot {
        workers: vec![
            audio.status().with_restart_policy(audio.restart_policy()),
            WorkerRuntimeStatus::from_health_result("download", download.health())
                .with_restart_policy(download.restart_policy()),
            plugin.status().with_restart_policy(plugin.restart_policy()),
            mcp_api
                .status()
                .with_restart_policy(mcp_api.restart_policy()),
            scan.status().with_restart_policy(scan.restart_policy()),
        ],
    }
}
