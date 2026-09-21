mod environment;
pub(crate) mod batch;
pub(crate) use batch::BatchState;
mod environment_process;
pub(crate) mod karaoke;
mod models;
mod runtime;
mod session;

use crate::{api_response::ApiResponse, store, workers::plugin::PluginWorkerState};
pub(crate) use environment::EnvironmentState;
use environment::EnvironmentStatus;
use models::{SeparationPlan, SeparationStatus};
pub(crate) use runtime::SeparationState;
use serde_json::{json, Value};
use std::path::Path;
use tauri::{AppHandle, Manager, State};

fn installed_plugin(app: &AppHandle, plugin_id: &str) -> Result<Value, String> {
    let installed = store::read_value(app, "plugins.installed")
        .map_err(|e| e.to_string())?
        .unwrap_or(json!([]));
    let plugin = installed
        .as_array()
        .and_then(|plugins| plugins.iter().find(|p| p["id"] == plugin_id))
        .ok_or_else(|| "请先安装音源分离插件。".to_string())?;
    validate_plugin(plugin)?;
    Ok(plugin.clone())
}

fn plugin_plan(app: &AppHandle, plugin_id: &str) -> Result<(String, SeparationPlan), String> {
    let plugin = installed_plugin(app, plugin_id)?;
    let entry = plugin["entry"].as_str().ok_or("插件缺少入口。")?;
    let config = store::read_plugin_config_value(app, plugin_id)
        .map_err(|e| e.to_string())?
        .unwrap_or(json!({}));
    // Python is chosen by the user's saved configuration, never by plugin output.
    let python = config["pythonPath"]
        .as_str()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("python")
        .to_string();
    let worker = app.state::<PluginWorkerState>();
    let response = worker.invoke_plugin(
        entry.into(),
        json!({"action": "separate", "config": config}),
        Some(plugin_id.into()),
        Some(vec![]),
    )?;
    if response["code"] != 1 {
        return Err(response["message"]
            .as_str()
            .unwrap_or("插件未返回分离方案。")
            .into());
    }
    let plan: SeparationPlan =
        serde_json::from_value(response["data"].clone()).map_err(|e| e.to_string())?;
    plan.validate()?;
    Ok((python, plan))
}

fn validate_plugin(plugin: &Value) -> Result<(), String> {
    let has = |key: &str, value: &str| {
        plugin[key]
            .as_array()
            .is_some_and(|items| items.iter().any(|item| item == value))
    };
    if plugin["enabled"] != true
        || plugin["kind"] != "tool"
        || plugin["runtime"] != "wasm"
        || !has("capabilities", "stem-separation")
        || !has("permissions", "audio-process")
        || !has("permissions", "network")
    {
        return Err("音源分离插件未启用，或缺少音频处理 / 模型下载权限。".into());
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn stem_separation_start(
    app: AppHandle,
    plugin_id: String,
    source: String,
    output_dir: String,
) -> ApiResponse<SeparationStatus> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let (python, plan) = plugin_plan(&app, &plugin_id)?;
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|e| e.to_string())?
            .join("demucs");
        app.state::<EnvironmentState>().while_idle(|| app.state::<BatchState>().while_idle(|| {
            app.state::<SeparationState>().start(
                plugin_id,
                &python,
                plan,
                Path::new(&source),
                Path::new(&output_dir),
                &cache,
            )
        }))
    })
    .await;
    ApiResponse::from_result(result.map_err(|e| e.to_string()).and_then(|result| result))
}

#[tauri::command]
pub(crate) fn stem_separation_status(
    state: State<'_, SeparationState>,
) -> ApiResponse<Option<SeparationStatus>> {
    ApiResponse::from_result(state.status())
}

#[tauri::command]
pub(crate) fn stem_separation_cancel(
    state: State<'_, SeparationState>,
    job_id: String,
) -> ApiResponse<()> {
    ApiResponse::from_empty_result(state.cancel(&job_id))
}

#[tauri::command]
pub(crate) fn stem_environment_check(
    app: AppHandle,
    plugin_id: String,
) -> ApiResponse<EnvironmentStatus> {
    ApiResponse::from_result(
        app.state::<EnvironmentState>()
            .begin(app.clone(), plugin_id, false),
    )
}

#[tauri::command]
pub(crate) fn stem_environment_prepare(
    app: AppHandle,
    plugin_id: String,
) -> ApiResponse<EnvironmentStatus> {
    ApiResponse::from_result(
        app.state::<EnvironmentState>()
            .begin(app.clone(), plugin_id, true),
    )
}

#[tauri::command]
pub(crate) fn stem_environment_status(
    state: State<'_, EnvironmentState>,
) -> ApiResponse<EnvironmentStatus> {
    ApiResponse::success(state.status())
}

#[tauri::command]
pub(crate) fn stem_environment_cancel(state: State<'_, EnvironmentState>) -> ApiResponse<()> {
    state.cancel();
    ApiResponse::ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_enabled_tool_and_explicit_permissions() {
        let plugin = json!({ "enabled": true, "kind": "tool", "runtime": "wasm", "capabilities": ["stem-separation"], "permissions": ["audio-process", "network"] });
        assert!(validate_plugin(&plugin).is_ok());
        for (key, value) in [
            ("enabled", json!(false)),
            ("kind", json!("music")),
            ("permissions", json!(["network"])),
            ("capabilities", json!([])),
        ] {
            let mut invalid = plugin.clone();
            invalid[key] = value;
            assert!(validate_plugin(&invalid).is_err());
        }
    }
}
