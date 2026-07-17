mod api_response;
mod app_error;
mod covers;
mod database;
mod diagnostics;
mod downloads;
mod lyrics;
mod mcp;
mod mcp_bridge;
mod models;
mod player;
mod plugins;
mod scanner;
mod shell;
mod state;
mod store;
mod system_media;
mod themes;
mod tray;
mod workers;

use database::{
    init_database, list_latest_added_tracks, list_tracks, refresh_track_duration, remove_music_dir,
    update_track_cover, update_track_metadata,
};
use scanner::{cancel_scan_music_dir, scan_music_dir};
use state::AppState;
use std::fs;
use std::sync::Mutex;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tray::{show_main_window, show_tray_menu_window};
pub use workers::run_worker_from_args;

const SETTINGS_KEY: &str = "mono-player-settings";

fn mcp_auto_start_enabled(app: &tauri::AppHandle) -> bool {
    store::read_value(app, SETTINGS_KEY)
        .ok()
        .flatten()
        .and_then(|settings| {
            settings
                .get("mcpAutoStart")
                .and_then(serde_json::Value::as_bool)
        })
        .unwrap_or(true)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let audio_cache_dir = app.path().app_cache_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db = rusqlite::Connection::open(app_data_dir.join("music-player.sqlite"))?;
            init_database(&db)?;
            app.manage(AppState { db: Mutex::new(db) });
            mcp_bridge::start(app.handle().clone(), app_data_dir.clone())?;
            let mcp_bridge_file = mcp_bridge::bridge_file_path(&app_data_dir);
            let mcp_api_worker = if mcp_auto_start_enabled(app.handle()) {
                match workers::mcp_api::McpApiWorkerState::start(
                    mcp_bridge_file,
                    "127.0.0.1".to_string(),
                    17331,
                    None,
                ) {
                    Ok(worker) => {
                        match worker.health() {
                            Ok(payload) => eprintln!(
                                "Mono MCP API worker auto-started: pid={} endpoint=http://127.0.0.1:17331/mcp",
                                payload
                                    .get("pid")
                                    .and_then(serde_json::Value::as_u64)
                                    .map(|pid| pid.to_string())
                                    .unwrap_or_else(|| "<unknown>".to_string())
                            ),
                            Err(err) => eprintln!("Mono MCP API worker auto-started, health unavailable: {err}"),
                        }
                        worker
                    }
                    Err(err) => {
                        eprintln!("Mono MCP API worker auto-start skipped: {err}");
                        workers::mcp_api::McpApiWorkerState::disabled(Some(err))
                    }
                }
            } else {
                eprintln!("Mono MCP API worker auto-start disabled by settings.");
                workers::mcp_api::McpApiWorkerState::disabled(None)
            };
            app.manage(mcp_api_worker);
            app.manage(player::PlayerState::new(audio_cache_dir.clone()));
            app.manage(workers::audio::AudioWorkerState::start(
                player::online_audio_cache_dir(&audio_cache_dir),
            )?);
            app.manage(workers::download::DownloadWorkerState::start(
                app.handle().clone(),
            )?);
            app.manage(workers::plugin::PluginWorkerState::start()?);
            app.manage(workers::scanner::ScanWorkerState::default());
            app.manage(system_media::init(app.handle()));
            themes::start_system_theme_watcher(app.handle().clone());

            if let Some(icon) = app.default_window_icon().cloned() {
                TrayIconBuilder::with_id("main-tray")
                    .icon(icon)
                    .show_menu_on_left_click(false)
                    .tooltip("Mono Player")
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button,
                            button_state: MouseButtonState::Up,
                            position,
                            ..
                        } = event
                        {
                            match button {
                                MouseButton::Left => show_main_window(tray.app_handle()),
                                MouseButton::Right => {
                                    let _ = show_tray_menu_window(
                                        tray.app_handle(),
                                        position.x,
                                        position.y,
                                    );
                                }
                                MouseButton::Middle => {}
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tracks,
            list_latest_added_tracks,
            remove_music_dir,
            update_track_metadata,
            update_track_cover,
            refresh_track_duration,
            scan_music_dir,
            cancel_scan_music_dir,
            lyrics::resolve_lyrics_source,
            lyrics::resolve_local_track_lyrics,
            covers::read_cover,
            covers::read_cover_thumbnail,
            covers::clear_cover_thumbnail_cache,
            diagnostics::system_worker_health,
            downloads::enqueue_download_online_track,
            downloads::download_lyrics_file,
            downloads::download_cover_file,
            downloads::delete_downloaded_track_file,
            downloads::open_downloaded_track_in_folder,
            themes::get_system_theme_state,
            themes::get_wallpaper_theme_color,
            themes::import_theme_folder,
            plugins::fetch_plugin_catalog,
            plugins::fetch_plugin_catalog_items,
            plugins::normalize_plugin_catalog_items,
            plugins::normalize_plugin_catalog_text,
            plugins::normalize_plugin_manifests,
            plugins::read_plugin_metadata_normalized,
            plugins::build_plugin_manifest_from_catalog,
            plugins::build_local_plugin_manifest,
            plugins::search_plugin,
            plugins::resolve_plugin_playback_plan,
            plugins::resolve_plugin_playback_qualities,
            plugins::resolve_plugin_playback_source,
            plugins::resolve_plugin_lyrics_metadata,
            plugins::plugin_invoke,
            plugins::read_plugin_wasm_bytes,
            plugins::plugin_http_request,
            tray::hide_main_window_to_tray,
            tray::update_tray_now_playing,
            player::player_default_cache_dir,
            player::player_system_temp_cache_dir,
            player::player_set_cache_dir,
            player::player_clear_cache,
            player::player_prune_cache,
            player::player_cache_status,
            player::player_set_queue,
            player::player_start_queue,
            player::player_queue_snapshot,
            player::player_next,
            player::player_previous,
            player::player_play_queue_source,
            player::player_queue_insert_next,
            player::player_queue_append,
            player::player_queue_remove,
            player::player_queue_move,
            player::player_output_devices,
            player::player_set_output_device,
            player::player_play_path,
            player::player_play_url,
            player::player_pause,
            player::player_stop,
            player::player_seek,
            player::player_set_volume,
            player::player_set_speed,
            player::player_state,
            shell::open_track_in_folder,
            system_media::system_media_update,
            system_media::system_media_clear,
            store::store_get,
            store::store_set,
            store::store_delete,
            tray::tray_popup_action,
            tray::exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
