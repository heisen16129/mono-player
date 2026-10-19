use std::{collections::HashMap, sync::{Arc, Mutex, Condvar}};

#[derive(Default)]
pub(super) struct Control { state: Mutex<String>, changed: Condvar }
impl Control {
    pub(super) fn set(&self, action: &str) {
        if let Ok(mut state) = self.state.lock() { *state = action.into(); self.changed.notify_all(); }
    }
    pub(super) fn wait(&self) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|e| e.to_string())?;
        while state.as_str() == "pause" { state = self.changed.wait(state).map_err(|e| e.to_string())?; }
        if state.as_str() == "cancel" { return Err("下载已取消".into()); }
        Ok(())
    }
}
#[derive(Default)]
pub(super) struct Controls(Mutex<HashMap<String, Arc<Control>>>);
impl Controls {
    pub(super) fn get(&self, id: &str) -> Arc<Control> { self.0.lock().unwrap().entry(id.into()).or_default().clone() }
    pub(super) fn remove(&self, id: &str) { self.0.lock().unwrap().remove(id); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn download_pause_waits_until_resume_or_cancel() {
        for action in ["resume", "cancel"] {
            let control = Arc::new(Control::default()); control.set("pause");
            let (tx, rx) = std::sync::mpsc::channel();
            let worker_control = control.clone();
            let worker = std::thread::spawn(move || { tx.send(worker_control.wait()).unwrap(); });
            assert!(rx.recv_timeout(std::time::Duration::from_millis(20)).is_err());
            control.set(action);
            assert_eq!(rx.recv_timeout(std::time::Duration::from_secs(1)).unwrap().is_ok(), action == "resume");
            worker.join().unwrap();
        }
    }
}
