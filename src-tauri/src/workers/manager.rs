use crate::workers::{
    lifecycle::WorkerRuntimeStatus,
    protocol::{decode_message, encode_line, WorkerMessage, WorkerRequest},
};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
};

pub(crate) struct WorkerProcess {
    worker: &'static str,
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    started_at_ms: u128,
    last_error: Option<String>,
}

pub(crate) struct WorkerProcessParts {
    pub(crate) worker: &'static str,
    pub(crate) child: Child,
    pub(crate) stdin: ChildStdin,
    pub(crate) stdout: BufReader<ChildStdout>,
    pub(crate) started_at_ms: u128,
}

impl WorkerProcess {
    pub(crate) fn spawn_current_exe(
        worker: &'static str,
        worker_flag: &str,
        args: &[String],
    ) -> Result<Self, String> {
        let parts = Self::spawn_current_exe_parts(worker, worker_flag, args)?;
        Ok(Self {
            worker: parts.worker,
            child: parts.child,
            stdin: parts.stdin,
            stdout: parts.stdout,
            started_at_ms: parts.started_at_ms,
            last_error: None,
        })
    }

    pub(crate) fn spawn_current_exe_parts(
        worker: &'static str,
        worker_flag: &str,
        args: &[String],
    ) -> Result<WorkerProcessParts, String> {
        let exe = std::env::current_exe().map_err(|err| err.to_string())?;
        let mut child = Command::new(exe)
            .arg(worker_flag)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|err| err.to_string())?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| format!("{worker_flag} worker stdin is unavailable"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| format!("{worker_flag} worker stdout is unavailable"))?;

        Ok(WorkerProcessParts {
            worker,
            child,
            stdin,
            stdout: BufReader::new(stdout),
            started_at_ms: crate::workers::worker_started_at_ms(),
        })
    }

    pub(crate) fn request(&mut self, request: &WorkerRequest) -> Result<WorkerMessage, String> {
        self.request_until_response(request, |_| Ok(()))
    }

    pub(crate) fn request_until_response<F>(
        &mut self,
        request: &WorkerRequest,
        mut on_event: F,
    ) -> Result<WorkerMessage, String>
    where
        F: FnMut(WorkerMessage) -> Result<(), String>,
    {
        let line = encode_line(request)?;
        self.stdin
            .write_all(line.as_bytes())
            .map_err(|err| err.to_string())?;
        self.stdin.flush().map_err(|err| err.to_string())?;

        loop {
            let mut response = String::new();
            let bytes_read = self
                .stdout
                .read_line(&mut response)
                .map_err(|err| err.to_string())?;
            if bytes_read == 0 {
                self.last_error = Some("worker closed stdout".to_string());
                return Err("worker closed stdout".to_string());
            }

            let message = decode_message(response.trim_end())?;
            match message {
                WorkerMessage::Response { .. } => return Ok(message),
                event => on_event(event)?,
            }
        }
    }

    pub(crate) fn id(&self) -> u32 {
        self.child.id()
    }

    pub(crate) fn is_running(&mut self) -> Result<bool, String> {
        match self.child.try_wait().map_err(|err| err.to_string())? {
            Some(status) => {
                self.last_error = Some(format!("{} worker exited: {status}", self.worker));
                Ok(false)
            }
            None => Ok(true),
        }
    }

    pub(crate) fn status(&mut self) -> WorkerRuntimeStatus {
        match self.is_running() {
            Ok(true) => WorkerRuntimeStatus::running(
                self.worker,
                Some(self.child.id()),
                Some(self.started_at_ms),
            ),
            Ok(false) => WorkerRuntimeStatus::stopped(self.worker, self.last_error.clone()),
            Err(error) => WorkerRuntimeStatus::stopped(self.worker, Some(error)),
        }
    }

    pub(crate) fn stop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for WorkerProcess {
    fn drop(&mut self) {
        self.stop();
    }
}
