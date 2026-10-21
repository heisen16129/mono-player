use crate::store;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Manager};

struct Service {
    child: Child,
    url: String,
    revision: String,
    _connection: crate::plugins::api::http::ServiceConnection,
}
impl Drop for Service {
    fn drop(&mut self) {
        // Closing stdin asks the service to persist and shut down its background timers.
        self.child.stdin.take();
        for _ in 0..90 {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
#[derive(Default)]
pub(crate) struct State(Mutex<std::collections::HashMap<String, Service>>);
impl State {
    pub(crate) fn shutdown(&self) {
        if let Ok(mut service) = self.0.lock() {
            service.clear();
        }
    }
}
pub(crate) fn installed(app: &AppHandle, id: &str) -> Result<Value, String> {
    if store::read_value(app, "mono-player-settings")
        .map_err(|e| e.to_string())?
        .is_some_and(|s| s["enablePlugins"] == false)
    {
        return Err("请先开启 Mono 的插件功能".into());
    }
    let plugins = store::read_value(app, "plugins.installed")
        .map_err(|e| e.to_string())?
        .unwrap_or(json!([]));
    let plugin = plugins
        .as_array()
        .and_then(|p| {
            p.iter().find(|p| {
                p["id"] == id
                    && p["enabled"] == true
                    && p["schemaVersion"] == 1 && p["apiVersion"] == 1
                    && p["entry"]["service"].as_str().is_some()
                    && p["permissions"].as_array().is_some_and(|c| c.iter().any(|v| v == "service.run"))
            })
        })
        .cloned()
        .ok_or_else(|| "请先安装并启用后台服务插件".to_string())?;
    let principal = crate::plugins::api::authorization::Principal { plugin_id: id.into(),
        package_revision: plugin["packageRevision"].as_str().unwrap_or_default().into(), surface:"service".into() };
    let grants = store::read_value(app, "plugins.api.grants").map_err(|e| e.to_string())?;
    crate::plugins::api::authorization::authorize(&principal, Some(&plugin), grants.as_ref().and_then(|v| v.get(id)), Some("service.run"))
        .map_err(|error| error.message)?;
    Ok(plugin)
}
fn start(app: &AppHandle, id: &str) -> Result<String, String> {
    let plugin = installed(app, id)?;
    let state = app.state::<State>();
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(service) = slot.get_mut(id) {
        if plugin["packageRevision"] == service.revision && service
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .is_none()
        {
            return Ok(service.url.clone());
        }
        slot.remove(id);
    }
    let package_root = PathBuf::from(plugin["packageRoot"].as_str().ok_or("插件安装目录缺失")?);
    let entry = |key: &str| -> Result<PathBuf, String> {
        let relative = plugin["entry"][key].as_str().filter(|path| crate::plugins::api::manifest::valid_path(path)).ok_or("插件入口无效")?;
        Ok(package_root.join(relative))
    };
    let service_entry = entry("service")?;
    let bundle = if cfg!(debug_assertions) { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../plugin/miot/dist") }
        else { app.path().resource_dir().map_err(|e|e.to_string())?.join("miot") };
    if !service_entry.is_file() {
        return Err("插件安装包缺少后台服务入口".into());
    }
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let revision = plugin["packageRevision"].as_str().ok_or("插件修订缺失")?.to_string();
    let connection = crate::plugins::api::http::start(app.clone(), crate::plugins::api::authorization::Principal {
        plugin_id: id.into(), package_revision: revision.clone(), surface:"service".into(),
    }, data.join("plugin-sessions"))?;
    let node = bundle.join(if cfg!(windows) { "node.exe" } else { "node" });
    let mut command = Command::new(if node.is_file() {
        node
    } else {
        PathBuf::from("node")
    });
    command
        .arg(service_entry)
        .arg(&connection.file)
        .arg(data.join("plugin-data").join(id))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| {
        "无法启动插件后台组件，请安装 Node.js 20 或更新版本，或使用含插件后台运行时的安装包".to_string()
    })?;
    let stdout = child.stdout.take().ok_or("插件后台服务缺少输出通道")?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                if let Some(url) = value["url"].as_str() {
                    let _ = tx.send(url.to_string());
                    break;
                }
            }
        }
    });
    let url = match rx.recv_timeout(Duration::from_secs(45)) {
        Ok(url) if url.starts_with("http://127.0.0.1:") => url,
        _ => {
            let _ = child.kill();
            let _ = child.wait();
            return Err("插件后台启动失败，请检查服务入口和运行环境".into());
        }
    };
    slot.insert(id.to_string(), Service {
        child,
        url: url.clone(),
        revision,
        _connection: connection,
    });
    Ok(url)
}

pub(crate) fn connection(app: &AppHandle, id: &str) -> Result<Value, String> {
    let mut url = tauri::Url::parse(&start(app, id)?).map_err(|e| e.to_string())?;
    let token = url.fragment().ok_or("插件后台服务凭据缺失")?.to_string();
    url.set_fragment(None);
    Ok(json!({"url":url.as_str(),"token":token}))
}
pub(crate) fn sync(app: &AppHandle) {
    let state = app.state::<State>();
    if let Ok(mut services) = state.0.lock() {
        services.retain(|id, service| installed(app, id).is_ok_and(|p| p["packageRevision"] == service.revision));
    };
}

pub(crate) fn request(app: &AppHandle, id: &str, method: &str, params: Value) -> Result<Value, String> {
    let connection = connection(app, id)?;
    let client = reqwest::blocking::Client::builder().no_proxy().timeout(Duration::from_secs(60)).build().map_err(|e| e.to_string())?;
    let response: Value = client.post(format!("{}rpc", connection["url"].as_str().ok_or("Missing URL")?))
        .bearer_auth(connection["token"].as_str().ok_or("Missing token")?)
        .header("Content-Type", "application/json").body(json!({"method":method,"params":params}).to_string()).send().map_err(|e|e.to_string())?
        .text().map_err(|e|e.to_string()).and_then(|text|serde_json::from_str(&text).map_err(|e|e.to_string()))?;
    if let Some(error) = response["error"].as_str() { return Err(error.into()); }
    Ok(response["data"].clone())
}
