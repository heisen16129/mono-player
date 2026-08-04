use crate::api_response::ApiResponse;
use serde::{Deserialize, Serialize};
use std::{
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const SLEEP_TIMER_STATUS_EVENT: &str = "sleep-timer://status";

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SleepTimerAction {
    Stop,
    Exit,
    FinishTrack,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SleepTimerSnapshot {
    pub(crate) action: SleepTimerAction,
    pub(crate) ends_at_ms: Option<u64>,
    pub(crate) is_active: bool,
    pub(crate) is_paused: bool,
    pub(crate) remaining_seconds: u64,
    pub(crate) total_seconds: u64,
}

#[derive(Debug)]
struct SleepTimerInner {
    action: SleepTimerAction,
    ends_at_ms: Option<u64>,
    generation: u64,
    paused_remaining_seconds: Option<u64>,
    pending_finish_track: bool,
    total_seconds: u64,
}

impl Default for SleepTimerInner {
    fn default() -> Self {
        Self {
            action: SleepTimerAction::Stop,
            ends_at_ms: None,
            generation: 0,
            paused_remaining_seconds: None,
            pending_finish_track: false,
            total_seconds: 0,
        }
    }
}

#[derive(Default)]
pub(crate) struct SleepTimerState {
    inner: Mutex<SleepTimerInner>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn remaining_seconds_for(ends_at_ms: Option<u64>) -> u64 {
    let Some(ends_at_ms) = ends_at_ms else {
        return 0;
    };
    let now = now_ms();
    if ends_at_ms <= now {
        0
    } else {
        ((ends_at_ms - now) as f64 / 1000.0).ceil() as u64
    }
}

fn snapshot_from_inner(inner: &SleepTimerInner) -> SleepTimerSnapshot {
    let active_remaining_seconds = remaining_seconds_for(inner.ends_at_ms);
    SleepTimerSnapshot {
        action: inner.action,
        ends_at_ms: inner.ends_at_ms,
        is_active: inner.ends_at_ms.is_some(),
        is_paused: inner.paused_remaining_seconds.is_some(),
        remaining_seconds: inner
            .paused_remaining_seconds
            .unwrap_or(active_remaining_seconds),
        total_seconds: inner.total_seconds,
    }
}

fn emit_status(app: &AppHandle, snapshot: &SleepTimerSnapshot) {
    let _ = app.emit(SLEEP_TIMER_STATUS_EVENT, snapshot);
}

impl SleepTimerState {
    fn snapshot(&self) -> Result<SleepTimerSnapshot, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(snapshot_from_inner(&inner))
    }

    fn clear(&self) -> Result<SleepTimerSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.ends_at_ms = None;
        inner.generation = inner.generation.wrapping_add(1);
        inner.paused_remaining_seconds = None;
        inner.pending_finish_track = false;
        Ok(snapshot_from_inner(&inner))
    }

    fn pause(&self) -> Result<SleepTimerSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        if inner.ends_at_ms.is_none() {
            return Ok(snapshot_from_inner(&inner));
        }
        inner.paused_remaining_seconds = Some(remaining_seconds_for(inner.ends_at_ms).max(1));
        inner.ends_at_ms = None;
        inner.generation = inner.generation.wrapping_add(1);
        Ok(snapshot_from_inner(&inner))
    }

    fn resume(&self, app: AppHandle) -> Result<SleepTimerSnapshot, String> {
        let (generation, snapshot) = {
            let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
            let Some(remaining_seconds) = inner.paused_remaining_seconds.take() else {
                return Ok(snapshot_from_inner(&inner));
            };
            inner.ends_at_ms =
                Some(now_ms().saturating_add(remaining_seconds.saturating_mul(1000)));
            inner.generation = inner.generation.wrapping_add(1);
            (inner.generation, snapshot_from_inner(&inner))
        };
        spawn_timer_runner(app, generation);
        Ok(snapshot)
    }

    fn start(
        &self,
        app: AppHandle,
        minutes: u64,
        action: SleepTimerAction,
    ) -> Result<SleepTimerSnapshot, String> {
        let minutes = minutes.clamp(1, 999);
        let total_seconds = minutes * 60;
        let (generation, snapshot) = {
            let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
            inner.action = action;
            inner.ends_at_ms = Some(now_ms().saturating_add(total_seconds.saturating_mul(1000)));
            inner.generation = inner.generation.wrapping_add(1);
            inner.paused_remaining_seconds = None;
            inner.pending_finish_track = false;
            inner.total_seconds = total_seconds;
            (inner.generation, snapshot_from_inner(&inner))
        };
        spawn_timer_runner(app, generation);
        Ok(snapshot)
    }

    fn timer_generation_matches(&self, generation: u64) -> Result<bool, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.generation == generation && inner.ends_at_ms.is_some())
    }

    fn complete_timer(&self, generation: u64) -> Result<Option<SleepTimerAction>, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        if inner.generation != generation || inner.ends_at_ms.is_none() {
            return Ok(None);
        }
        let action = inner.action;
        inner.ends_at_ms = None;
        inner.paused_remaining_seconds = None;
        inner.generation = inner.generation.wrapping_add(1);
        inner.pending_finish_track = matches!(action, SleepTimerAction::FinishTrack);
        Ok(Some(action))
    }

    fn consume_finish_track_pending(&self) -> Result<bool, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        if !inner.pending_finish_track {
            return Ok(false);
        }
        inner.pending_finish_track = false;
        Ok(true)
    }
}

fn spawn_timer_runner(app: AppHandle, generation: u64) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(1000));

        let state = app.state::<SleepTimerState>();
        match state.timer_generation_matches(generation) {
            Ok(true) => {}
            _ => break,
        }

        let snapshot = match state.snapshot() {
            Ok(snapshot) => snapshot,
            Err(_) => break,
        };
        emit_status(&app, &snapshot);

        if snapshot.remaining_seconds > 0 {
            continue;
        }

        let action = match state.complete_timer(generation) {
            Ok(Some(action)) => action,
            _ => break,
        };
        if let Ok(snapshot) = state.snapshot() {
            emit_status(&app, &snapshot);
        }

        match action {
            SleepTimerAction::Stop => {
                let _ = crate::player::mcp_stop(&app);
            }
            SleepTimerAction::Exit => {
                let _ = crate::player::mcp_stop(&app);
                app.exit(0);
            }
            SleepTimerAction::FinishTrack => {}
        }
        break;
    });
}

pub(crate) fn consume_finish_track_pending(app: &AppHandle) -> bool {
    app.state::<SleepTimerState>()
        .consume_finish_track_pending()
        .unwrap_or(false)
}

pub(crate) fn start_sleep_timer_backend(
    app: AppHandle,
    minutes: u64,
    action: SleepTimerAction,
) -> Result<SleepTimerSnapshot, String> {
    let state = app.state::<SleepTimerState>();
    let snapshot = state.start(app.clone(), minutes, action)?;
    emit_status(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn sleep_timer_status(
    state: State<'_, SleepTimerState>,
) -> ApiResponse<SleepTimerSnapshot> {
    ApiResponse::from_result(state.snapshot())
}

#[tauri::command]
pub(crate) fn sleep_timer_start(
    app: AppHandle,
    minutes: u64,
    action: SleepTimerAction,
) -> ApiResponse<SleepTimerSnapshot> {
    ApiResponse::from_result(start_sleep_timer_backend(app, minutes, action))
}

#[tauri::command]
pub(crate) fn sleep_timer_clear(
    app: AppHandle,
    state: State<'_, SleepTimerState>,
) -> ApiResponse<SleepTimerSnapshot> {
    ApiResponse::from_result((|| {
        let snapshot = state.clear()?;
        emit_status(&app, &snapshot);
        Ok(snapshot)
    })())
}

#[tauri::command]
pub(crate) fn sleep_timer_pause(
    app: AppHandle,
    state: State<'_, SleepTimerState>,
) -> ApiResponse<SleepTimerSnapshot> {
    ApiResponse::from_result((|| {
        let snapshot = state.pause()?;
        emit_status(&app, &snapshot);
        Ok(snapshot)
    })())
}

#[tauri::command]
pub(crate) fn sleep_timer_resume(
    app: AppHandle,
    state: State<'_, SleepTimerState>,
) -> ApiResponse<SleepTimerSnapshot> {
    ApiResponse::from_result((|| {
        let snapshot = state.resume(app.clone())?;
        emit_status(&app, &snapshot);
        Ok(snapshot)
    })())
}
