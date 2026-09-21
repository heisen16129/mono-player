use std::time::Instant;
use tauri::{AppHandle, Manager};

pub(crate) struct StartupClock(pub Instant);

#[tauri::command]
pub(crate) async fn startup_trace(app: AppHandle, stage: String, elapsed_ms: f64) {
    let clock = app.state::<StartupClock>();
    eprintln!("[startup] {stage} frontend_ms={elapsed_ms:.0} app_ms={}", clock.0.elapsed().as_millis());
}
