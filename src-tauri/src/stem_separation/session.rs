use std::{io::{BufRead, BufReader, Write}, process::{Child, ChildStdout, Stdio}, sync::{Arc, Mutex}};
use serde_json::Value;

pub(super) struct Session {
    pub child: Arc<Mutex<Child>>,
    output: BufReader<ChildStdout>,
}

impl Session {
    pub fn start(python: &str) -> Result<Self, String> {
        let mut child = super::environment_process::hidden_command(python)
            .args(["-I", "-u", "-c", include_str!("worker.py"), "--persistent"])
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .spawn().map_err(|e| format!("无法启动分离环境：{e}"))?;
        let output = BufReader::new(child.stdout.take().unwrap());
        let stderr = child.stderr.take().unwrap();
        std::thread::spawn(move || { super::runtime::read_tail(stderr); });
        Ok(Self { child: Arc::new(Mutex::new(child)), output })
    }

    pub fn send(&self, request: &Value) -> Result<(), String> {
        let mut child = self.child.lock().map_err(|e| e.to_string())?;
        let input = child.stdin.as_mut().ok_or("分离进程已关闭")?;
        writeln!(input, "{request}").and_then(|_| input.flush()).map_err(|e| e.to_string())
    }

    pub fn receive(&mut self) -> Result<Value, String> {
        let mut line = String::new();
        if self.output.read_line(&mut line).map_err(|e| e.to_string())? == 0 {
            return Err("分离进程意外退出，请检查可用内存和分离环境。".into());
        }
        serde_json::from_str(&line).map_err(|e| e.to_string())
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "Requires the prepared Demucs test environment and model cache"]
    fn model_loads_once_and_worker_survives_invalid_tracks() {
        let python = std::env::var("MONO_STEM_TEST_PYTHON").unwrap();
        let cache = std::env::var("MONO_STEM_TEST_CACHE").unwrap();
        let root = std::env::temp_dir().join(format!("mono-session-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let source = root.join("invalid.wav");
        std::fs::write(&source, b"invalid audio").unwrap();
        let mut session = Session::start(&python).unwrap();
        let pid = session.child.lock().unwrap().id();
        for expected_loads in [1, 0] {
            session.send(&serde_json::json!({"source": source, "outputDir": root, "cacheDir": cache, "model": "htdemucs_6s", "device": "cpu"})).unwrap();
            let mut loads = 0;
            loop {
                let event = session.receive().unwrap();
                if event["stage"] == "loading" { loads += 1; }
                if event["stage"] == "error" { break; }
            }
            assert_eq!(loads, expected_loads);
            assert_eq!(session.child.lock().unwrap().id(), pid);
            assert!(session.child.lock().unwrap().try_wait().unwrap().is_none());
        }
        let child = session.child.clone();
        drop(session);
        assert!(child.lock().unwrap().try_wait().unwrap().is_some());
        std::fs::remove_dir_all(root).unwrap();
    }
}
