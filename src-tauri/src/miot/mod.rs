mod runtime_paths;
use crate::{api_response::ApiResponse, store};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Manager};

pub(crate) const ID: &str = "mono-wasm-miot";
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
pub(crate) struct MiotState(Mutex<Option<Service>>);
impl MiotState {
    pub(crate) fn shutdown(&self) {
        if let Ok(mut service) = self.0.lock() {
            service.take();
        }
    }
}
pub(crate) fn installed(app: &AppHandle) -> Result<Value, String> {
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
                p["id"] == ID
                    && p["enabled"] == true
                    && p["schemaVersion"] == 1 && p["apiVersion"] == 1
                    && p["capabilities"]
                        .as_array()
                        .is_some_and(|c| c.iter().any(|v| v == "speaker-control"))
                    && p["permissions"].as_array().is_some_and(|c| {
                        c.iter().any(|v| v == "network") && c.iter().any(|v| v == "speaker-service")
                    })
            })
        })
        .cloned()
        .ok_or_else(|| "请先安装并启用 v1 小爱音箱插件".to_string())?;
    let principal = crate::plugins::api::authorization::Principal { plugin_id: ID.into(),
        package_revision: plugin["packageRevision"].as_str().unwrap_or_default().into(), surface:"service".into() };
    let grants = store::read_value(app, "plugins.api.grants").map_err(|e| e.to_string())?;
    crate::plugins::api::authorization::authorize(&principal, Some(&plugin), grants.as_ref().and_then(|v| v.get(ID)), Some("speaker-service"))
        .map_err(|error| error.message)?;
    Ok(plugin)
}
fn start(app: &AppHandle) -> Result<String, String> {
    let plugin = installed(app)?;
    let state = app.state::<MiotState>();
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(service) = slot.as_mut() {
        if plugin["packageRevision"] == service.revision && service
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .is_none()
        {
            return Ok(service.url.clone());
        }
        slot.take();
    }
    let package_root = PathBuf::from(plugin["packageRoot"].as_str().ok_or("插件安装目录缺失")?);
    let entry = |key: &str| -> Result<PathBuf, String> {
        let relative = plugin["entry"][key].as_str().filter(|path| crate::plugins::api::manifest::valid_path(path)).ok_or("插件入口无效")?;
        Ok(package_root.join(relative))
    };
    let service_entry = entry("service")?;
    let bundle = if cfg!(debug_assertions) { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../plugin/miot/dist") }
        else { app.path().resource_dir().map_err(|e|e.to_string())?.join("miot") };
    if !service_entry.is_file() || !package_root.join("ui/dist/index.html").is_file() {
        return Err("音箱插件包缺少服务或页面入口".into());
    }
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let revision = plugin["packageRevision"].as_str().ok_or("插件修订缺失")?.to_string();
    let connection = crate::plugins::api::http::start(app.clone(), crate::plugins::api::authorization::Principal {
        plugin_id: ID.into(), package_revision: revision.clone(), surface:"service".into(),
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
        .arg(data.join("miot"))
        .arg(package_root.join("ui/dist"))
        .arg(runtime_paths::ffmpeg(&bundle))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| {
        "无法启动音箱组件，请安装 Node.js 20 或更新版本，或使用含音箱运行时的安装包".to_string()
    })?;
    let stdout = child.stdout.take().ok_or("音箱服务缺少输出通道")?;
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
            return Err("音箱服务启动失败，请检查组件是否完整、17843 端口是否被占用".into());
        }
    };
    *slot = Some(Service {
        child,
        url: url.clone(),
        revision,
        _connection: connection,
    });
    Ok(url)
}

pub(crate) fn connection(app: &AppHandle) -> Result<Value, String> {
    let mut url = tauri::Url::parse(&start(app)?).map_err(|e| e.to_string())?;
    let token = url.fragment().ok_or("音箱服务凭据缺失")?.to_string();
    url.set_fragment(None);
    Ok(json!({"url":url.as_str(),"token":token}))
}
#[tauri::command]
pub(crate) async fn miot_sync(app: AppHandle) -> ApiResponse<()> {
    ApiResponse::from_result(
        tauri::async_runtime::spawn_blocking(move || {
            sync_service(&app)
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r),
    )
}

pub(crate) fn sync_service(app: &AppHandle) -> Result<(), String> {
    if installed(app).is_ok() { start(app).map(|_| ()) }
    else { app.state::<MiotState>().shutdown(); Ok(()) }
}
