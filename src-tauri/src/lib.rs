mod settings;
mod api_response;
mod app_error;
mod covers;
mod desktop_window;
mod database;
mod downloads;
mod download_records;
mod favorites;
mod playlists;
mod recent_played;
mod library_statistics;
mod library_search;
mod search_history;
mod lyrics;
mod mcp;
mod mcp_bridge;
mod mcp_service;
mod metadata;
mod models;
mod miot;
mod player;
mod plugins;
mod scanner;
mod shell;
mod sleep_timer;
mod state;
mod startup;
mod stem_separation;
mod store;
mod themes;
mod custom_themes;
mod library_directories;
mod tray;
mod wallpaper_engine;
mod workers;

use database::{
    init_database, list_latest_added_tracks, list_tracks, read_track_audio_info,
    refresh_track_duration, update_track_cover, update_track_metadata,
};
use scanner::cancel_scan_music_dir;
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
    let startup_started = std::time::Instant::now();
    tauri::Builder::default()
        .manage(startup::StartupClock(startup_started))
        .register_uri_scheme_protocol("wallpaper-frame", |context, request| {
            wallpaper_engine::frame_response(context.app_handle(), request)
        })
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let app_data_dir = app.path().app_data_dir()?;
            let audio_cache_dir = app.path().app_cache_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db = rusqlite::Connection::open(app_data_dir.join("music-player.sqlite"))?;
            init_database(&db)?;
            store::migrate_download_records(app.handle(), &db).map_err(std::io::Error::other)?;
            database::download_records::recover_interrupted(&db).map_err(std::io::Error::other)?;
            store::migrate_search_history(app.handle(), &db).map_err(std::io::Error::other)?;
            store::clear_legacy_playlists(app.handle()).map_err(std::io::Error::other)?;
            app.manage(AppState { db: Mutex::new(db) });
            mcp_bridge::start(app.handle().clone(), app_data_dir.clone())?;
            let mcp_bridge_file = mcp_bridge::bridge_file_path(&app_data_dir);
            let mcp_host = "127.0.0.1".to_string();
            let mcp_port = 17331;
            let mcp_token = None;
            let mcp_api_worker = if mcp_auto_start_enabled(app.handle()) {
                match workers::mcp_api::McpApiWorkerState::start(
                    mcp_bridge_file.clone(),
                    mcp_host.clone(),
                    mcp_port,
                    mcp_token.clone(),
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
                        workers::mcp_api::McpApiWorkerState::disabled(
                            mcp_bridge_file.clone(),
                            mcp_host.clone(),
                            mcp_port,
                            mcp_token.clone(),
                            Some(err),
                        )
                    }
                }
            } else {
                eprintln!("Mono MCP API worker auto-start disabled by settings.");
                workers::mcp_api::McpApiWorkerState::disabled(
                    mcp_bridge_file.clone(),
                    mcp_host.clone(),
                    mcp_port,
                    mcp_token.clone(),
                    None,
                )
            };
            app.manage(mcp_api_worker);
            app.manage(player::PlayerState::new(audio_cache_dir.clone()));
            app.manage(workers::audio::AudioWorkerState::start(
                player::online_audio_cache_dir(&audio_cache_dir),
            )?);
            player::cache_settings::initialize(app.handle()).map_err(std::io::Error::other)?;
            app.manage(workers::download::DownloadWorkerState::start(
                app.handle().clone(),
            )?);
            app.manage(workers::plugin::PluginWorkerState::start(audio_cache_dir.clone())?);
            app.manage(workers::scanner::ScanWorkerState::default());
            app.manage(scanner::batch::ScanBatchState::default());
            app.manage(plugins::online_search::OnlineSearchState::default());
            app.manage(plugins::online_search::LyricsSearchState::default());
            app.manage(sleep_timer::SleepTimerState::default());
            app.manage(miot::MiotState::default());
            app.manage(stem_separation::EnvironmentState::default());
            app.manage(stem_separation::SeparationState::default());
            app.manage(stem_separation::BatchState::default());
            app.manage(wallpaper_engine::WallpaperEngineState::default());
            let miot_app = app.handle().clone();
            tauri::async_runtime::spawn(async move { let _ = miot::miot_sync(miot_app).await; });
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

            eprintln!("[startup] setup-complete app_ms={}", startup_started.elapsed().as_millis());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            startup::startup_trace,
            library_statistics::read_library_statistics,
            library_search::search_library,
            search_history::update_search_history,
            recent_played::list_recently_played_tracks,
            playlists::list_playlists,
            playlists::create_playlist,
            playlists::rename_playlist,
            playlists::update_playlist_cover,
            playlists::delete_playlist,
            playlists::edit_playlist_tracks,
            favorites::list_favorites,
            favorites::add_favorite,
            favorites::remove_favorite,
            list_tracks,
            list_latest_added_tracks,
            library_directories::update_library_directories,
            update_track_metadata,
            update_track_cover,
            refresh_track_duration,
            read_track_audio_info,
            scanner::batch::scan_music_dirs,
            cancel_scan_music_dir,
            lyrics::resolve_lyrics_source,
            lyrics::resolve_local_track_lyrics,
            covers::read_artwork_file,
            covers::read_remote_cover,
            desktop_window::resize_desktop_lyrics,
            covers::read_track_cover_original,
            covers::crop_cover_image,
            mcp_service::mcp_service_status,
            mcp_service::mcp_service_start,
            mcp_service::mcp_service_stop,
            mcp_service::mcp_service_restart,
            downloads::enqueue_download_online_track,
            download_records::download_records_snapshot,
            download_records::download_record_action,
            downloads::download_lyrics_file,
            downloads::download_cover_file,
            downloads::open_downloaded_track_in_folder,
            plugins::management::plugin_list,
            plugins::catalog::plugin_catalog,
            plugins::management::plugin_action,
            plugins::management::plugin_batch,
            plugins::read_local_renderer_module,
            plugins::read_remote_renderer_module,
            plugins::search_plugin,
            plugins::online_search::search_online_music,
            plugins::online_search::search_online_lyrics,
            plugins::resolve_plugin_playback_qualities,
            plugins::resolve_plugin_lyrics_metadata,
            miot::miot_open,
            miot::miot_sync,
            stem_separation::stem_separation_start,
            stem_separation::batch::stem_batch_start,
            stem_separation::batch::stem_batch_status,
            stem_separation::batch::stem_batch_cancel,
            stem_separation::batch::stem_output_directory,
            stem_separation::karaoke::karaoke_prepare,
            stem_separation::karaoke::karaoke_has_accompaniment,
            player::karaoke_source::karaoke_playback_source,
            stem_separation::karaoke::karaoke_switch,
            stem_separation::karaoke::karaoke_set_vocals,
            stem_separation::stem_separation_status,
            stem_separation::stem_environment_check,
            stem_separation::stem_environment_prepare,
            stem_separation::stem_environment_status,
            stem_separation::stem_environment_cancel,
            stem_separation::stem_separation_cancel,
            plugins::plugin_invoke,
            tray::hide_main_window_to_tray,
            player::player_default_cache_dir,
            player::player_system_temp_cache_dir,
            player::player_clear_cache,
            player::player_cache_status,
            player::player_start_queue,
            player::player_restore_queue,
            player::player_set_playback_mode,
            player::session::player_read_session,
            player::player_next,
            player::player_previous,
            player::player_change_queue_track_quality,
            player::player_queue_insert_next,
            player::player_queue_append,
            player::player_queue_remove,
            player::player_output_devices,
            player::player_set_output_device,
            player::player_pause,
            player::player_resume,
            player::player_stop,
            player::player_seek,
            player::player_set_volume,
            player::player_set_speed,
            sleep_timer::sleep_timer_status,
            sleep_timer::sleep_timer_start,
            sleep_timer::sleep_timer_clear,
            sleep_timer::sleep_timer_pause,
            sleep_timer::sleep_timer_resume,
            shell::open_track_in_folder,
            store::store_get,
            store::store_set,
            store::settings_set,
            custom_themes::theme_list,
            custom_themes::theme_upsert,
            custom_themes::theme_remove,
            custom_themes::theme_select,
            store::plugin_config_get,
            store::plugin_config_set,
            tray::tray_popup_action,
            tray::tray_snapshot,
            wallpaper_engine::wallpaper_engine_list_projects,
            wallpaper_engine::wallpaper_engine_start_scene,
            wallpaper_engine::wallpaper_engine_scene_status,
            wallpaper_engine::wallpaper_engine_stop_scene,
            tray::exit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                player::session::save_logged(app);
                app.state::<miot::MiotState>().shutdown();
                app.state::<stem_separation::EnvironmentState>().shutdown();
                let _ = app.state::<stem_separation::BatchState>().cancel(&app.state::<stem_separation::SeparationState>());
                app.state::<stem_separation::SeparationState>().shutdown();
                wallpaper_engine::shutdown(app);
            }
        });
}
