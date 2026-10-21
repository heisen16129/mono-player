use super::authorization::{authorize, permissions, Principal};
use std::path::Path;
use tauri::{http::{Request, Response}, AppHandle, Manager};

fn route(path: &str) -> Option<(String, String, String)> {
    let mut decoded = Vec::new();
    let mut bytes = path.as_bytes().iter().copied();
    while let Some(byte) = bytes.next() {
        if byte == b'%' {
            let hex = [bytes.next()?, bytes.next()?];
            decoded.push(u8::from_str_radix(std::str::from_utf8(&hex).ok()?, 16).ok()?);
        } else { decoded.push(byte); }
    }
    let decoded = String::from_utf8(decoded).ok()?;
    let mut parts = decoded.strip_prefix('/')?.splitn(3, '/');
    let id = parts.next()?;
    let revision = parts.next()?;
    let file = parts.next()?;
    if !super::manifest::valid_path(id) || id.contains('/') || revision.len() != 64
        || !revision.bytes().all(|byte| byte.is_ascii_hexdigit())
        || !super::manifest::valid_path(file) || !(file.starts_with("ui/") || file.starts_with("assets/")) { return None; }
    Some((id.into(), revision.into(), file.into()))
}

fn content_type(path: &str) -> Option<&'static str> {
    match Path::new(path).extension()?.to_str()? {
        "html" => Some("text/html; charset=utf-8"),
        "js" | "mjs" => Some("text/javascript; charset=utf-8"),
        "css" => Some("text/css; charset=utf-8"),
        "json" => Some("application/json"),
        "svg" => Some("image/svg+xml"),
        "png" => Some("image/png"), "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"), "gif" => Some("image/gif"),
        "woff" => Some("font/woff"), "woff2" => Some("font/woff2"),
        "ttf" => Some("font/ttf"), "otf" => Some("font/otf"), "wasm" => Some("application/wasm"),
        _ => None,
    }
}

pub(crate) fn response(app: &AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let resource = (|| -> Option<(Vec<u8>, &'static str, bool)> {
        if request.method() != "GET" { return None; }
        let (id, revision, file) = route(request.uri().path())?;
        let values = crate::store::read_values(app).ok()?;
        if values.get("mono-player-settings").is_some_and(|s| s["enablePlugins"] == false) { return None; }
        let manifest = values.get("plugins.installed")?.as_array()?.iter().find(|item| item["id"] == id)?;
        let grant = values.get("plugins.api.grants")?.get(&id)?;
        let principal = Principal { plugin_id: id, package_revision: revision, surface: "page".into() };
        authorize(&principal, Some(manifest), Some(grant), None).ok()?;
        let managed = app.path().app_data_dir().ok()?.join("plugins-v1").canonicalize().ok()?;
        let root = Path::new(manifest["packageRoot"].as_str()?).canonicalize().ok()?;
        if !root.starts_with(&managed) || root == managed { return None; }
        let target = root.join(&file).canonicalize().ok()?;
        if !target.starts_with(&root) || !target.is_file() || target.metadata().ok()?.len() > 64 * 1024 * 1024 { return None; }
        Some((std::fs::read(target).ok()?, content_type(&file)?, permissions(manifest, grant).iter().any(|p| p == "network")))
    })();
    let (status, body, mime, network) = match resource {
        Some((body, mime, network)) => (200, body, mime, network),
        None => (404, b"Plugin resource unavailable".to_vec(), "text/plain", false),
    };
    let connections = if network { "https: http://127.0.0.1:*" } else { "'none'" };
    Response::builder().status(status)
        .header("Content-Type", mime).header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-store").header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", format!("default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http://127.0.0.1:*; font-src 'self' data:; media-src 'self' blob: data: https: http://127.0.0.1:*; connect-src {connections}; frame-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'"))
        .body(body).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resource_paths_cannot_escape_package_or_read_backend() {
        let prefix = format!("/example/{}/", "a".repeat(64));
        assert!(route(&(prefix.clone() + "ui/assets/main.js")).is_some());
        assert!(route(&(prefix.clone() + "assets/%E5%B0%81%E9%9D%A2.png")).is_some());
        for file in ["ui/../backend/service.mjs", "ui/%2e%2e/private", "ui/%5csecret", "backend/plugin.wasm", "ui/file%00.js", "ui/%ff", "ui/C:/private"] {
            assert!(route(&(prefix.clone() + file)).is_none(), "{file}");
        }
    }
    #[test]
    fn bundled_icon_fonts_and_modules_have_browser_content_types() {
        assert_eq!(content_type("ui/assets/miot-ui-icons.otf"), Some("font/otf"));
        assert_eq!(content_type("ui/renderer.mjs"), Some("text/javascript; charset=utf-8"));
        assert!(content_type("backend/node.exe").is_none());
    }
}
