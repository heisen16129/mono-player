use super::media::{Leases, Source};
use std::{collections::HashMap, fs::File, io::{self, Read, Seek, SeekFrom, Write},
    net::{TcpListener, TcpStream}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, thread, time::{Duration, Instant}};
use tauri::AppHandle;

struct Request { token: String, head: bool, range: Option<String> }

fn parse(header: &str, host: &str) -> Option<Request> {
    let mut lines = header.split("\r\n");
    let first = lines.next()?.split(' ').collect::<Vec<_>>();
    if first.len() != 3 || !matches!(first[0], "GET" | "HEAD") || first[2] != "HTTP/1.1" { return None; }
    let token = first[1].strip_prefix("/media/")?;
    if token.len() != 64 || !token.bytes().all(|c| c.is_ascii_hexdigit()) { return None; }
    let mut headers = HashMap::new();
    for line in lines.filter(|l| !l.is_empty()) {
        let (name, value) = line.split_once(':')?;
        if headers.insert(name.to_ascii_lowercase(), value.trim()).is_some() { return None; }
    }
    if headers.get("host") != Some(&host) || headers.contains_key("transfer-encoding")
        || headers.get("content-length").is_some_and(|v| *v != "0")
        || headers.get("origin").is_some_and(|v| *v != "null") { return None; }
    let range = headers.get("range").map(|v| v.to_string());
    if range.as_ref().is_some_and(|v| range_parts(v).is_none()) { return None; }
    Some(Request { token:token.into(),head:first[0] == "HEAD",range })
}

fn range_parts(value: &str) -> Option<(Option<u64>, Option<u64>)> {
    let (start, end) = value.strip_prefix("bytes=")?.split_once('-')?;
    let number = |part: &str| -> Option<Option<u64>> {
        if part.is_empty() { Some(None) }
        else if part.bytes().all(|b| b.is_ascii_digit()) { Some(Some(part.parse().ok()?)) } else { None }
    };
    let (start, end) = (number(start)?, number(end)?);
    if start.is_none() && (end.is_none() || end == Some(0)) { return None; }
    if start.zip(end).is_some_and(|(a,b)| a > b) { return None; }
    Some((start, end))
}

fn byte_range(value: &str, size: u64) -> Option<(u64, u64)> {
    let (start, end) = range_parts(value)?;
    if size == 0 { return None; }
    let begin = start.unwrap_or_else(|| size.saturating_sub(end.unwrap()));
    let end = if start.is_some() { end.unwrap_or(size - 1).min(size - 1) } else { size - 1 };
    (begin <= end && begin < size).then_some((begin, end))
}

fn headers(stream: &mut impl Write, status: u16, extra: &str) -> io::Result<()> {
    let reason = match status { 200 => "OK", 206 => "Partial Content", 416 => "Range Not Satisfiable",
        403 => "Forbidden", 404 => "Not Found", _ => "Bad Gateway" };
    write!(stream, "HTTP/1.1 {status} {reason}\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges\r\n{extra}\r\n")
}

fn copy_checked(reader: &mut impl Read, writer: &mut impl Write, mut authorized: impl FnMut() -> bool) -> io::Result<()> {
    let mut buffer = [0; 64 * 1024];
    loop {
        if !authorized() { return Err(io::Error::new(io::ErrorKind::PermissionDenied, "Media authorization ended")); }
        let count = reader.read(&mut buffer)?;
        if count == 0 { return Ok(()); }
        // Recheck after a potentially blocking upstream read.
        if !authorized() { return Err(io::Error::new(io::ErrorKind::PermissionDenied, "Media authorization ended")); }
        writer.write_all(&buffer[..count])?;
    }
}

fn serve(stream: &mut TcpStream, request: &Request, source: &Source, mut check: impl FnMut() -> bool) -> io::Result<()> {
    let mut last_check = Instant::now();
    let mut authorized = || {
        if last_check.elapsed() < Duration::from_secs(1) { return true; }
        last_check = Instant::now();
        check()
    };
    match source {
        Source::File(path) => {
            let mut file = match File::open(path) {
                Ok(file) => file,
                Err(_) => return headers(stream, 404, "Content-Length: 0\r\n"),
            };
            let size = file.metadata()?.len();
            let range = match &request.range {
                Some(value) => match byte_range(value, size) {
                    Some(range) => Some(range),
                    None => return headers(stream, 416, &format!("Content-Range: bytes */{size}\r\nContent-Length: 0\r\n")),
                }, None => None,
            };
            let (start, length) = range.map(|(start,end)| (start,end-start+1)).unwrap_or((0,size));
            let content_type = match path.extension().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
                "mp3" => "audio/mpeg", "flac" => "audio/flac", "wav" => "audio/wav",
                "m4a" | "mp4" => "audio/mp4", "ogg" | "opus" => "audio/ogg", _ => "application/octet-stream",
            };
            let mut extra = format!("Content-Type: {content_type}\r\nContent-Length: {length}\r\nAccept-Ranges: bytes\r\n");
            if let Some((start,end)) = range { extra += &format!("Content-Range: bytes {start}-{end}/{size}\r\n"); }
            headers(stream, if range.is_some() {206} else {200}, &extra)?;
            if request.head { return Ok(()); }
            file.seek(SeekFrom::Start(start))?;
            copy_checked(&mut file.take(length), stream, &mut authorized)
        }
        Source::Remote(url) => {
            let client = reqwest::blocking::Client::builder().connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(300)).no_gzip().no_deflate().build().map_err(io::Error::other)?;
            let mut upstream = client.request(if request.head { reqwest::Method::HEAD } else { reqwest::Method::GET }, url)
                .header("Accept-Encoding", "identity");
            if let Some(range) = &request.range { upstream = upstream.header("Range", range); }
            let mut response = match upstream.send() {
                Ok(response) => response,
                Err(_) => return headers(stream, 502, "Content-Length: 0\r\n"),
            };
            if !authorized() { return headers(stream, 403, "Content-Length: 0\r\n"); }
            let status = response.status().as_u16();
            if !matches!(status, 200 | 206 | 416) { return headers(stream, 502, "Content-Length: 0\r\n"); }
            if status == 416 {
                let range = response.headers().get("content-range").and_then(|v| v.to_str().ok())
                    .map(|v| format!("Content-Range: {v}\r\n")).unwrap_or_default();
                return headers(stream, 416, &format!("Content-Length: 0\r\n{range}"));
            }
            let mut extra = String::new();
            for key in ["content-length", "content-range", "accept-ranges"] {
                if let Some(value) = response.headers().get(key).and_then(|v| v.to_str().ok()) {
                    extra += &format!("{key}: {value}\r\n");
                }
            }
            let mime = response.headers().get("content-type").and_then(|v| v.to_str().ok())
                .filter(|v| v.starts_with("audio/")).unwrap_or("application/octet-stream");
            extra += &format!("Content-Type: {mime}\r\n");
            headers(stream, status, &extra)?;
            if request.head { return Ok(()); }
            copy_checked(&mut response, stream, &mut authorized)
        }
    }
}

fn handle(mut stream: TcpStream, host: &str, leases: &Leases, app: &AppHandle) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    let started = Instant::now();
    let mut bytes = Vec::new();
    let mut buffer = [0; 1024];
    while !bytes.ends_with(b"\r\n\r\n") {
        if bytes.len() > 16384 || started.elapsed() > Duration::from_secs(5) { return Ok(()); }
        let count = stream.read(&mut buffer)?;
        if count == 0 { return Ok(()); }
        bytes.extend_from_slice(&buffer[..count]);
    }
    if bytes.len() > 16384 { return Ok(()); }
    let Some(request) = std::str::from_utf8(&bytes).ok().and_then(|h| parse(h, host)) else {
        return headers(&mut stream, 403, "Content-Length: 0\r\n");
    };
    let lease = leases.lock().ok().and_then(|leases| leases.get(&request.token).cloned());
    let Some(lease) = lease else { return headers(&mut stream, 404, "Content-Length: 0\r\n"); };
    if lease.check(app).is_err() { return headers(&mut stream, 403, "Content-Length: 0\r\n"); }
    serve(&mut stream, &request, &lease.source, || lease.check(app).is_ok())
}

pub(super) fn start(app: AppHandle, leases: Leases, stopped: Arc<AtomicBool>) -> io::Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    listener.set_nonblocking(true)?;
    let host = listener.local_addr()?.to_string();
    let (send, receive) = std::sync::mpsc::sync_channel::<TcpStream>(16);
    let receive = Arc::new(Mutex::new(receive));
    for _ in 0..4 {
        let (app, leases, host, receive) = (app.clone(), leases.clone(), host.clone(), receive.clone());
        thread::spawn(move || loop {
            let stream = match receive.lock().ok().and_then(|r| r.recv().ok()) { Some(s) => s, None => break };
            let _ = handle(stream, &host, &leases, &app);
        });
    }
    thread::spawn(move || {
        while !stopped.load(Ordering::Acquire) {
            match listener.accept() {
                Ok((stream, _)) => { let _ = send.try_send(stream); },
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
                Err(_) => break,
            }
        }
    });
    Ok(host)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fetch(source: Source, head: bool, range: Option<&str>) -> Vec<u8> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let request = Request { token:"unused".into(), head, range:range.map(str::to_string) };
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            serve(&mut stream, &request, &source, || true).unwrap();
        });
        let mut stream = TcpStream::connect(address).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut bytes = Vec::new();
        stream.read_to_end(&mut bytes).unwrap();
        server.join().unwrap();
        bytes
    }

    #[test]
    fn local_http_returns_exact_ranges_and_head_without_body() {
        let path = std::env::temp_dir().join(format!("mono-media-{}.mp3", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"0123456789").unwrap();
        let response = fetch(Source::File(path.clone()), false, Some("bytes=2-5"));
        let text = String::from_utf8(response).unwrap();
        assert!(text.starts_with("HTTP/1.1 206"));
        assert!(text.contains("Content-Range: bytes 2-5/10\r\n"));
        assert!(text.ends_with("\r\n\r\n2345"));
        let head = String::from_utf8(fetch(Source::File(path.clone()), true, None)).unwrap();
        assert!(head.contains("Content-Length: 10\r\n"));
        assert!(head.ends_with("\r\n\r\n"));
        let invalid = String::from_utf8(fetch(Source::File(path.clone()), false, Some("bytes=100-"))).unwrap();
        assert!(invalid.starts_with("HTTP/1.1 416"));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn remote_proxy_forwards_range_without_exposing_private_url() {
        let upstream = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/private?token=secret", upstream.local_addr().unwrap());
        let server = thread::spawn(move || {
            let (mut stream, _) = upstream.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
            let mut bytes = Vec::new();
            let mut byte = [0; 1];
            while !bytes.ends_with(b"\r\n\r\n") {
                stream.read_exact(&mut byte).unwrap();
                bytes.push(byte[0]);
            }
            let request = String::from_utf8(bytes).unwrap().to_ascii_lowercase();
            assert!(request.contains("range: bytes=2-5\r\n"));
            stream.write_all(b"HTTP/1.1 206 Partial Content\r\nContent-Length: 4\r\nContent-Range: bytes 2-5/10\r\nContent-Type: audio/mpeg\r\nLocation: /private?token=secret\r\nConnection: close\r\n\r\n2345").unwrap();
        });
        let response = String::from_utf8(fetch(Source::Remote(url), false, Some("bytes=2-5"))).unwrap();
        server.join().unwrap();
        assert!(response.starts_with("HTTP/1.1 206"));
        assert!(response.ends_with("\r\n\r\n2345"));
        assert!(!response.contains("secret"));
    }
    #[test]
    fn ranges_support_seeking_suffix_and_unsatisfiable_requests() {
        assert_eq!(byte_range("bytes=2-4", 10), Some((2,4)));
        assert_eq!(byte_range("bytes=8-", 10), Some((8,9)));
        assert_eq!(byte_range("bytes=-3", 10), Some((7,9)));
        assert_eq!(byte_range("bytes=0-999", 10), Some((0,9)));
        for range in ["bytes=10-", "bytes=-0", "bytes=4-2", "bytes=0-1,3-4", "bytes=+1-2", "bytes=18446744073709551616-"] {
            assert_eq!(byte_range(range, 10), None);
        }
        assert_eq!(byte_range("bytes=0-", 0), None);
    }

    #[test]
    fn media_requests_reject_other_hosts_origins_and_duplicate_headers() {
        let request = format!("GET /media/{} HTTP/1.1\r\nHost: 127.0.0.1:1\r\n\r\n", "a".repeat(64));
        assert!(parse(&request, "127.0.0.1:1").is_some());
        for bad in [request.replace("GET", "POST"), request.replace("127.0.0.1:1", "evil.test"),
            request.replace("\r\n\r\n", "\r\nOrigin: https://evil.test\r\n\r\n"),
            request.replace("\r\n\r\n", "\r\nHost: 127.0.0.1:1\r\n\r\n")] {
            assert!(parse(&bad, "127.0.0.1:1").is_none());
        }
    }

    #[test]
    fn revoked_stream_stops_before_writing_the_next_chunk() {
        let mut reader = io::Cursor::new(vec![1; 128 * 1024]);
        let mut output = Vec::new();
        let mut checks = 0;
        let result = copy_checked(&mut reader, &mut output, || { checks += 1; checks <= 2 });
        assert_eq!(result.unwrap_err().kind(), io::ErrorKind::PermissionDenied);
        assert_eq!(output.len(), 64 * 1024);
    }
}
