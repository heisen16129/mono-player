use super::{authorization::Principal, dispatch};
use crate::models::plugin_api::Request;
use serde_json::{json, Value};
use std::{io::{Read, Write}, net::{TcpListener, TcpStream}, path::PathBuf, sync::{Arc, atomic::{AtomicBool, Ordering}}, thread, time::Duration};
use tauri::AppHandle;

pub(crate) struct ServiceConnection {
    pub file: PathBuf,
    stopped: Arc<AtomicBool>,
}

impl Drop for ServiceConnection {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Release);
        let _ = std::fs::remove_file(&self.file);
    }
}

fn read_request(stream: &mut TcpStream, token: &str, host: &str) -> Result<Request, String> {
    let started = std::time::Instant::now();
    stream.set_read_timeout(Some(Duration::from_secs(2))).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    let mut chunk = [0; 4096];
    let header_end = loop {
        if started.elapsed() > Duration::from_secs(5) { return Err("Request timed out".into()); }
        let count = stream.read(&mut chunk).map_err(|e| e.to_string())?;
        if count == 0 { return Err("Incomplete request".into()); }
        bytes.extend_from_slice(&chunk[..count]);
        if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") { break end + 4; }
        if bytes.len() > 16384 { return Err("Headers too large".into()); }
    };
    if header_end > 16384 { return Err("Headers too large".into()); }
    let header = std::str::from_utf8(&bytes[..header_end]).map_err(|_| "Invalid headers")?;
    let length = validate_headers(header, token, host)?;
    if bytes.len() > header_end + length { return Err("Unexpected request body".into()); }
    while bytes.len() < header_end + length {
        if started.elapsed() > Duration::from_secs(5) { return Err("Request timed out".into()); }
        let remaining = (header_end + length - bytes.len()).min(chunk.len());
        let count = stream.read(&mut chunk[..remaining]).map_err(|e| e.to_string())?;
        if count == 0 { return Err("Incomplete request".into()); }
        bytes.extend_from_slice(&chunk[..count]);
    }
    serde_json::from_slice(&bytes[header_end..]).map_err(|_| "Invalid public API request".into())
}

fn validate_headers(header: &str, token: &str, host: &str) -> Result<usize, String> {
    let mut lines = header.split("\r\n");
    if lines.next() != Some("POST /plugin-api/v1 HTTP/1.1") { return Err("Unsupported request".into()); }
    let mut headers = std::collections::HashMap::new();
    for line in lines.filter(|line| !line.is_empty()) {
        let (name, value) = line.split_once(':').ok_or("Invalid header")?;
        if headers.insert(name.to_ascii_lowercase(), value.trim()).is_some() { return Err("Duplicate header".into()); }
    }
    if headers.contains_key("origin") || headers.contains_key("transfer-encoding")
        || headers.get("host") != Some(&host) || headers.get("authorization").copied() != Some(format!("Bearer {token}").as_str()) {
        return Err("Unauthorized service request".into());
    }
    let length = headers.get("content-length").ok_or("Missing content length")?.parse::<usize>().map_err(|_| "Invalid content length")?;
    if length > 1024 * 1024 { return Err("Request too large".into()); }
    Ok(length)
}

pub(crate) fn start(app: AppHandle, principal: Principal, directory: PathBuf) -> Result<ServiceConnection, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let host = listener.local_addr().map_err(|e| e.to_string())?.to_string();
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let file = directory.join(format!("{}.json", uuid::Uuid::new_v4()));
    std::fs::write(&file, serde_json::to_vec(&json!({"endpoint":format!("http://{host}/plugin-api/v1"),"sessionToken":token})).unwrap()).map_err(|e| e.to_string())?;
    let stopped = Arc::new(AtomicBool::new(false));
    let connection = ServiceConnection { file, stopped: stopped.clone() };
    thread::spawn(move || {
        // A bounded worker pool prevents a service from creating unbounded host threads.
        let (send, receive) = std::sync::mpsc::sync_channel::<TcpStream>(16);
        let receive = Arc::new(std::sync::Mutex::new(receive));
        for _ in 0..4 {
            let (app, principal, host, token, receive, stopped) = (app.clone(), principal.clone(), host.clone(), token.clone(), receive.clone(), stopped.clone());
            thread::spawn(move || loop {
                let stream = receive.lock().unwrap().recv();
                let Ok(mut stream) = stream else { break; };
                if stopped.load(Ordering::Acquire) { break; }
                let response = read_request(&mut stream, &token, &host);
                if stopped.load(Ordering::Acquire) { break; }
                let (status, body): (&str, Value) = match response {
                    Ok(request) => ("200 OK", dispatch(&app, &principal, &request)),
                    Err(_) => ("403 Forbidden", json!({"error":"Service request rejected"})),
                };
                let body = serde_json::to_vec(&body).unwrap();
                let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
                let _ = write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n", body.len());
                let _ = stream.write_all(&body);
            });
        }
        while !stopped.load(Ordering::Acquire) {
            match listener.accept() {
                Ok((stream, _)) => { let _ = send.try_send(stream); }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
                Err(_) => break,
            }
        }
    });
    Ok(connection)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn service_transport_rejects_browser_requests_legacy_tokens_and_ambiguous_framing() {
        let header = "POST /plugin-api/v1 HTTP/1.1\r\nHost: 127.0.0.1:1\r\nAuthorization: Bearer secret\r\nContent-Length: 2\r\n\r\n";
        assert_eq!(validate_headers(header, "secret", "127.0.0.1:1").unwrap(), 2);
        for bad in [header.replace("Authorization: Bearer", "x-mono-mcp-token:"), header.replace("Content-Length: 2", "Origin: null\r\nContent-Length: 2"), header.replace("Content-Length: 2", "Content-Length: 2\r\nContent-Length: 3"), header.replace("Content-Length: 2", "Transfer-Encoding: chunked"), header.replace("Content-Length: 2", "Content-Length: 1048577")] {
            assert!(validate_headers(&bad, "secret", "127.0.0.1:1").is_err());
        }
        assert!(validate_headers(header, "other", "127.0.0.1:1").is_err());
    }
}
