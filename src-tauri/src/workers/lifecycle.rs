use serde::Serialize;
use serde_json::Value;
use std::{process::Child, sync::Mutex};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum RestartPolicy {
    RestartOnceAndRetry,
    RestartBeforeSendOnly,
    NoRestart,
    PerTask,
}

impl RestartPolicy {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::RestartOnceAndRetry => "restartOnceAndRetry",
            Self::RestartBeforeSendOnly => "restartBeforeSendOnly",
            Self::NoRestart => "noRestart",
            Self::PerTask => "perTask",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkerRuntimeStatus {
    pub(crate) worker: String,
    pub(crate) running: bool,
    pub(crate) pid: Option<u32>,
    pub(crate) started_at_ms: Option<u128>,
    pub(crate) error: Option<String>,
    pub(crate) restart_policy: Option<&'static str>,
}

impl WorkerRuntimeStatus {
    pub(crate) fn running(
        worker: impl Into<String>,
        pid: Option<u32>,
        started_at_ms: Option<u128>,
    ) -> Self {
        Self {
            worker: worker.into(),
            running: true,
            pid,
            started_at_ms,
            error: None,
            restart_policy: None,
        }
    }

    pub(crate) fn stopped(worker: impl Into<String>, error: Option<String>) -> Self {
        Self {
            worker: worker.into(),
            running: false,
            pid: None,
            started_at_ms: None,
            error,
            restart_policy: None,
        }
    }

    pub(crate) fn with_restart_policy(mut self, policy: RestartPolicy) -> Self {
        self.restart_policy = Some(policy.as_str());
        self
    }

    pub(crate) fn from_health_result(worker: &str, result: Result<Value, String>) -> Self {
        match result {
            Ok(payload) => Self::running(
                payload
                    .get("worker")
                    .and_then(Value::as_str)
                    .unwrap_or(worker),
                payload
                    .get("pid")
                    .and_then(Value::as_u64)
                    .and_then(|pid| u32::try_from(pid).ok()),
                payload
                    .get("startedAtMs")
                    .and_then(Value::as_u64)
                    .map(u128::from),
            ),
            Err(error) => Self::stopped(worker, Some(error)),
        }
    }
}

pub(crate) struct WorkerChild {
    worker: &'static str,
    child: Mutex<Option<Child>>,
    started_at_ms: Option<u128>,
    last_error: Mutex<Option<String>>,
}

impl WorkerChild {
    pub(crate) fn running(worker: &'static str, child: Child) -> Self {
        Self {
            worker,
            child: Mutex::new(Some(child)),
            started_at_ms: Some(crate::workers::worker_started_at_ms()),
            last_error: Mutex::new(None),
        }
    }

    pub(crate) fn disabled(worker: &'static str, error: Option<String>) -> Self {
        Self {
            worker,
            child: Mutex::new(None),
            started_at_ms: None,
            last_error: Mutex::new(error),
        }
    }

    pub(crate) fn pid(&self) -> Result<Option<u32>, String> {
        self.child
            .lock()
            .map(|child| child.as_ref().map(Child::id))
            .map_err(|err| err.to_string())
    }

    pub(crate) fn is_running(&self) -> Result<bool, String> {
        let mut child = self.child.lock().map_err(|err| err.to_string())?;
        let Some(child_process) = child.as_mut() else {
            return Ok(false);
        };
        match child_process.try_wait().map_err(|err| err.to_string())? {
            Some(status) => {
                let error = format!("{} worker exited: {status}", self.worker);
                self.set_last_error(Some(error));
                *child = None;
                Ok(false)
            }
            None => Ok(true),
        }
    }

    pub(crate) fn status(&self) -> WorkerRuntimeStatus {
        match self.is_running() {
            Ok(true) => WorkerRuntimeStatus::running(
                self.worker,
                self.pid().ok().flatten(),
                self.started_at_ms,
            ),
            Ok(false) => WorkerRuntimeStatus::stopped(self.worker, self.last_error()),
            Err(error) => WorkerRuntimeStatus::stopped(self.worker, Some(error)),
        }
    }

    pub(crate) fn stop(&self) {
        self.kill();
        self.wait();
    }

    pub(crate) fn kill(&self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(child) = child.as_mut() {
                let _ = child.kill();
            }
        }
    }

    pub(crate) fn wait(&self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(child) = child.as_mut() {
                let _ = child.wait();
            }
            *child = None;
        }
    }

    fn last_error(&self) -> Option<String> {
        self.last_error.lock().ok().and_then(|error| error.clone())
    }

    fn set_last_error(&self, error: Option<String>) {
        if let Ok(mut last_error) = self.last_error.lock() {
            *last_error = error;
        }
    }
}

impl Drop for WorkerChild {
    fn drop(&mut self) {
        self.stop();
    }
}
