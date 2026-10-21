use crate::{api_response::ApiResponse, plugins::services, workers::audio::AudioWorkerState};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub(crate) fn karaoke_set_vocals(app: AppHandle, source: String, gain: f32) -> ApiResponse<()> {
    ApiResponse::from_empty_result(app.state::<AudioWorkerState>().set_karaoke_vocals(source,gain))
}
#[tauri::command]
pub(crate) async fn karaoke_prepare(app: AppHandle, plugin_id: String, source: String, check_only: Option<bool>) -> ApiResponse<Value> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || {
        let input=app.state::<AudioWorkerState>().karaoke_source(&source)?.canonicalize().map_err(|e|e.to_string())?;
        services::request(&app,&plugin_id,"prepareKaraoke",json!({"source":input,"checkOnly":check_only.unwrap_or(false)}))
    }).await.map_err(|e|e.to_string()).and_then(|r|r))
}
#[tauri::command]
pub(crate) async fn karaoke_has_accompaniment(app: AppHandle, source: String, provider_id: Option<String>, track_id: Option<String>) -> ApiResponse<bool> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || {
        let worker=app.state::<AudioWorkerState>();
        let input=if std::path::Path::new(&source).is_file() { Some(std::path::PathBuf::from(&source)) }
            else { worker.karaoke_source(&source).ok().or_else(||worker.completed_cache_for_track(provider_id.as_deref()?,track_id.as_deref()?,None).map(|cache|cache.path)) };
        let Some(input)=input else { return Ok(false); };
        Ok(services::request(&app,super::ID,"prepareKaraoke",json!({"source":input,"checkOnly":true})).is_ok_and(|v|v["accompaniment"].is_string()))
    }).await.map_err(|e|e.to_string()).and_then(|r|r))
}
#[tauri::command]
pub(crate) async fn karaoke_switch(app: AppHandle, plugin_id: String, source: String, accompaniment: Option<String>) -> ApiResponse<()> {
    ApiResponse::from_result(tauri::async_runtime::spawn_blocking(move || {
        if let Some(path)=&accompaniment {
            let input=app.state::<AudioWorkerState>().karaoke_source(&source)?.canonicalize().map_err(|e|e.to_string())?;
            let ready=services::request(&app,&plugin_id,"prepareKaraoke",json!({"source":input,"checkOnly":true}))?;
            if ready["accompaniment"].as_str()!=Some(path.as_str()) { return Err("伴奏不属于当前歌曲或尚未生成完成".into()); }
            let root=app.path().app_data_dir().map_err(|e|e.to_string())?.join("plugin-data").join(&plugin_id).join("output").canonicalize().map_err(|e|e.to_string())?;
            let target=std::path::Path::new(path).canonicalize().map_err(|e|e.to_string())?;
            if !target.starts_with(root) { return Err("无效的伴奏文件".into()); }
        }
        app.state::<AudioWorkerState>().switch_karaoke(&source,accompaniment)?;
        let snapshot=app.state::<AudioWorkerState>().state()?; let _=app.emit("player://state",snapshot); Ok(())
    }).await.map_err(|e|e.to_string()).and_then(|r|r))
}
