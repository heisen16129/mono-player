use crate::api_response::ApiResponse;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

#[tauri::command]
pub(crate) fn hide_main_window_to_tray(app: AppHandle) -> ApiResponse<()> {
    ApiResponse::from_empty_result(hide_main_window_to_tray_inner(app))
}

fn hide_main_window_to_tray_inner(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("main window not found".to_string());
    };

    window.hide().map_err(|err| err.to_string())
}

#[tauri::command]
pub(crate) fn exit_app(app: AppHandle) {
    app.exit(0);
}

pub(crate) fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn emit_tray_action(app: &AppHandle, action: &str) {
    let _ = app.emit("tray-menu-action", action);
}

pub(crate) fn show_tray_menu_window(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    const WIDTH: f64 = 228.0;
    const HEIGHT: f64 = 304.0;

    let position = PhysicalPosition::new(
        (x - WIDTH - 10.0).max(8.0) as i32,
        (y - HEIGHT - 10.0).max(8.0) as i32,
    );

    if let Some(window) = app.get_webview_window("tray-menu") {
        window
            .set_size(tauri::LogicalSize::new(WIDTH, HEIGHT))
            .map_err(|err| err.to_string())?;
        window
            .set_position(position)
            .map_err(|err| err.to_string())?;
        window.show().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        app,
        "tray-menu",
        WebviewUrl::App("index.html?tray=1".into()),
    )
    .title("Mono Player")
    .inner_size(WIDTH, HEIGHT)
    .position(position.x as f64, position.y as f64)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .focused(true)
    .build()
    .map_err(|err| err.to_string())?;

    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            if let Some(window) = app_handle.get_webview_window("tray-menu") {
                let _ = window.hide();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub(crate) fn tray_popup_action(app: AppHandle, action: String) -> ApiResponse<()> {
    if let Some(window) = app.get_webview_window("tray-menu") {
        let _ = window.hide();
    }

    match action.as_str() {
        "show" => show_main_window(&app),
        "settings" => {
            show_main_window(&app);
            emit_tray_action(&app, "settings");
        }
        "exit" => app.exit(0),
        value => emit_tray_action(&app, value),
    }

    ApiResponse::ok()
}

#[tauri::command]
pub(crate) fn update_tray_now_playing(app: AppHandle, title: String) -> ApiResponse<()> {
    ApiResponse::from_empty_result(update_tray_now_playing_inner(app, title))
}

fn update_tray_now_playing_inner(app: AppHandle, title: String) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main-tray") else {
        return Ok(());
    };

    tray.set_tooltip(Some(if title.trim().is_empty() {
        "Mono Player"
    } else {
        title.trim()
    }))
    .map_err(|err| err.to_string())
}
