use serde::Serialize;
use serde_json::Value;
use std::collections::{hash_map::DefaultHasher, HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{Manager, State, Window};

#[cfg(windows)]
mod capture;
#[cfg(windows)]
mod paths;
#[cfg(windows)]
mod runtime;
#[cfg(windows)]
mod sampling;
#[cfg(windows)]
mod surface;

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM},
    UI::WindowsAndMessaging::{EnumWindows, GetWindowTextLengthW, GetWindowTextW},
};

const WALLPAPER_ENGINE_APP_ID: &str = "431960";
const MAX_PROJECT_JSON_BYTES: u64 = 1024 * 1024;

#[derive(Clone)]
struct WallpaperEngineRecord {
    project_file: PathBuf,
    scene_package: Option<PathBuf>,
}

#[derive(Default)]
pub(crate) struct WallpaperEngineState {
    projects: Mutex<HashMap<String, WallpaperEngineRecord>>,
    runtime: Arc<RuntimeState>,
}

#[derive(Default)]
struct RuntimeState {
    session: Mutex<Option<WallpaperEngineSession>>,
    operation: Mutex<()>,
    generation: AtomicU64,
}

impl Drop for WallpaperEngineState {
    fn drop(&mut self) {
        self.shutdown();
    }
}

impl WallpaperEngineState {
    fn shutdown(&self) {
        self.runtime.generation.fetch_add(1, Ordering::AcqRel);
        let Ok(_operation) = self.runtime.operation.lock() else {
            return;
        };
        let previous = self
            .runtime
            .session
            .lock()
            .ok()
            .and_then(|mut active| active.take());
        if let Some(session) = previous {
            close_scene_session(session);
        }
    }
}

pub(crate) fn shutdown(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<WallpaperEngineState>() {
        state.shutdown();
    }
}

struct WallpaperEngineSession {
    id: String,
    session_id: String,
    location: String,
    executable: PathBuf,
    #[cfg(windows)]
    surface: surface::Surface,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WallpaperEngineProject {
    id: String,
    title: String,
    project_type: String,
    media_type: String,
    media_path: String,
    preview_path: String,
    playable: bool,
    engine_playable: bool,
    source_label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WallpaperEngineLibrarySnapshot {
    projects: Vec<WallpaperEngineProject>,
    count: usize,
    engine_available: bool,
    engine_executable: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WallpaperEngineSceneStatus {
    active: bool,
    project_id: String,
    session_id: String,
}

fn normalized_path(value: impl AsRef<Path>) -> Option<PathBuf> {
    fs::canonicalize(value).ok()
}

fn is_inside(root: &Path, target: &Path) -> bool {
    target == root || target.starts_with(root)
}

fn project_id(root: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    root.to_string_lossy().to_lowercase().hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn clean_text(value: Option<&str>, fallback: &str) -> String {
    let text = value
        .unwrap_or_default()
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if text.is_empty() {
        fallback.to_string()
    } else {
        text.chars().take(160).collect()
    }
}

fn safe_project_file(root: &Path, value: Option<&str>, extensions: &[&str]) -> Option<PathBuf> {
    let relative = Path::new(value?.trim());
    if relative.as_os_str().is_empty() || relative.is_absolute() {
        return None;
    }
    let target = normalized_path(root.join(relative))?;
    if !is_inside(root, &target) || !target.is_file() {
        return None;
    }
    let extension = target.extension()?.to_string_lossy().to_lowercase();
    extensions.contains(&extension.as_str()).then_some(target)
}

fn first_existing_project_file(
    root: &Path,
    candidates: &[Option<&str>],
    extensions: &[&str],
) -> Option<PathBuf> {
    candidates
        .iter()
        .find_map(|candidate| safe_project_file(root, *candidate, extensions))
}

fn is_valid_scene_package(path: &Path) -> bool {
    let Ok(mut file) = fs::File::open(path) else {
        return false;
    };
    let mut header = [0u8; 8];
    if file.read_exact(&mut header).is_err() {
        return false;
    }
    header[0..4] == *b"PKGV" || header[4..8] == *b"PKGV"
}

fn index_project(
    root: &Path,
    source_label: &str,
) -> Option<(WallpaperEngineProject, WallpaperEngineRecord)> {
    let root = normalized_path(root)?;
    let project_file = root.join("project.json");
    let metadata = fs::metadata(&project_file).ok()?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_PROJECT_JSON_BYTES {
        return None;
    }
    let manifest: Value = serde_json::from_str(&fs::read_to_string(&project_file).ok()?).ok()?;
    let project = manifest.as_object()?;
    let project_type = project
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    let direct_file = project.get("file").and_then(Value::as_str);
    let image_extensions = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    let video_extensions = ["mp4", "webm", "m4v", "mov"];
    let scene_extensions = ["pkg", "pak"];
    let media = match project_type.as_str() {
        "image" => safe_project_file(&root, direct_file, &image_extensions),
        "video" => safe_project_file(&root, direct_file, &video_extensions),
        _ => None,
    };
    let preview = first_existing_project_file(
        &root,
        &[
            project.get("preview").and_then(Value::as_str),
            project.get("cover").and_then(Value::as_str),
            project.get("poster").and_then(Value::as_str),
            Some("preview.jpg"),
            Some("preview.jpeg"),
            Some("preview.png"),
            Some("preview.webp"),
            Some("cover.jpg"),
            Some("cover.png"),
        ],
        &image_extensions,
    );
    let scene_package = if project_type == "scene" {
        first_existing_project_file(
            &root,
            &[direct_file, Some("scene.pkg"), Some("scene.pak")],
            &scene_extensions,
        )
        .filter(|path| is_valid_scene_package(path))
    } else {
        None
    };
    if media.is_none() && preview.is_none() && scene_package.is_none() {
        return None;
    }
    let media_type = media
        .as_ref()
        .and_then(|path| path.extension())
        .map(|extension| extension.to_string_lossy().to_lowercase())
        .map(|extension| {
            if video_extensions.contains(&extension.as_str()) {
                "video"
            } else {
                "image"
            }
        })
        .unwrap_or_default()
        .to_string();
    let fallback_title = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Wallpaper Engine");
    let id = project_id(&root);
    let item = WallpaperEngineProject {
        id: id.clone(),
        title: clean_text(project.get("title").and_then(Value::as_str), fallback_title),
        project_type: if project_type.is_empty() {
            "unknown".to_string()
        } else {
            project_type
        },
        media_type,
        media_path: media
            .as_ref()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        preview_path: preview
            .as_ref()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        playable: media.is_some(),
        engine_playable: scene_package.is_some(),
        source_label: source_label.to_string(),
    };
    Some((
        item,
        WallpaperEngineRecord {
            project_file,
            scene_package,
        },
    ))
}

fn registry_steam_roots() -> Vec<PathBuf> {
    let queries = [
        (r"HKCU\Software\Valve\Steam", "SteamPath"),
        (r"HKLM\SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
        (r"HKLM\SOFTWARE\Valve\Steam", "InstallPath"),
    ];
    queries
        .iter()
        .filter_map(|(key, value)| {
            let output = Command::new("reg.exe")
                .args(["query", key, "/v", value])
                .output()
                .ok()?;
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .find_map(|line| {
                    let parts = line.split_whitespace().collect::<Vec<_>>();
                    let value_type = parts.iter().position(|part| part.starts_with("REG_"))?;
                    (value_type + 1 < parts.len())
                        .then(|| PathBuf::from(parts[value_type + 1..].join(" ")))
                })
        })
        .collect()
}

fn steam_library_roots() -> Vec<PathBuf> {
    let mut candidates = registry_steam_roots();
    candidates.extend([
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
        PathBuf::from(r"D:\Steam"),
        PathBuf::from(r"D:\SteamLibrary"),
        PathBuf::from(r"E:\Steam"),
        PathBuf::from(r"E:\SteamLibrary"),
    ]);
    let mut roots = HashSet::new();
    for candidate in candidates {
        if !candidate.is_dir() {
            continue;
        }
        roots.insert(candidate.clone());
        for file in [
            candidate.join("steamapps").join("libraryfolders.vdf"),
            candidate.join("config").join("libraryfolders.vdf"),
        ] {
            let Ok(contents) = fs::read_to_string(file) else {
                continue;
            };
            for line in contents.lines() {
                let trimmed = line.trim();
                if !trimmed.starts_with("\"path\"") {
                    continue;
                }
                let parts = trimmed.split('"').collect::<Vec<_>>();
                if let Some(path) = parts.get(3) {
                    let path = PathBuf::from(path.replace("\\\\", "\\"));
                    if path.is_dir() {
                        roots.insert(path);
                    }
                }
            }
        }
    }
    roots.into_iter().collect()
}

fn project_containers(manual_root: Option<&str>) -> Vec<(PathBuf, String)> {
    let mut containers = Vec::new();
    for library in steam_library_roots() {
        containers.push((
            library
                .join("steamapps")
                .join("workshop")
                .join("content")
                .join(WALLPAPER_ENGINE_APP_ID),
            "Steam 创意工坊".to_string(),
        ));
        containers.push((
            library
                .join("steamapps")
                .join("common")
                .join("wallpaper_engine")
                .join("projects")
                .join("myprojects"),
            "Wallpaper Engine 本地项目".to_string(),
        ));
    }
    if let Some(root) = manual_root.map(str::trim).filter(|root| !root.is_empty()) {
        containers.push((PathBuf::from(root), "手动导入".to_string()));
    }
    containers
}

fn scan_container(container: &Path) -> Vec<PathBuf> {
    if container.join("project.json").is_file() {
        return vec![container.to_path_buf()];
    }
    fs::read_dir(container)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join("project.json").is_file())
        .collect()
}

fn discover_engine_executable() -> Option<PathBuf> {
    steam_library_roots().into_iter().find_map(|library| {
        ["wallpaper64.exe", "wallpaper32.exe"]
            .iter()
            .map(|name| {
                library
                    .join("steamapps")
                    .join("common")
                    .join("wallpaper_engine")
                    .join(name)
            })
            .find(|path| path.is_file())
    })
}

fn run_engine_control(executable: &Path, arguments: &[&str]) -> Result<(), String> {
    let mut command = Command::new(executable);
    command
        .args(arguments)
        .current_dir(executable.parent().unwrap());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Wallpaper Engine 控制命令失败：{error}"))
}

fn close_scene_session(session: WallpaperEngineSession) {
    #[cfg(windows)]
    drop(session.surface);
    close_scene_location(&session.executable, &session.location);
}

fn close_scene_location(executable: &Path, location: &str) {
    let _ = run_engine_control(
        executable,
        &["-control", "closeWallpaper", "-location", location],
    );
}

#[cfg(windows)]
struct WindowSearch {
    title: Vec<u16>,
    found: HWND,
}

#[cfg(windows)]
unsafe extern "system" fn find_window_callback(hwnd: HWND, lparam: LPARAM) -> i32 {
    let search = &mut *(lparam as *mut WindowSearch);
    let length = GetWindowTextLengthW(hwnd);
    if length <= 0 {
        return 1;
    }
    let mut title = vec![0u16; length as usize + 1];
    let read = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);
    title.truncate(read.max(0) as usize);
    if title == search.title {
        search.found = hwnd;
        return 0;
    }
    1
}

#[cfg(windows)]
fn find_window_by_title(title: &str, timeout: Duration) -> Option<HWND> {
    let deadline = Instant::now() + timeout;
    let title = title.encode_utf16().collect::<Vec<_>>();
    while Instant::now() < deadline {
        let mut search = WindowSearch {
            title: title.clone(),
            found: std::ptr::null_mut(),
        };
        unsafe {
            EnumWindows(
                Some(find_window_callback),
                &mut search as *mut WindowSearch as LPARAM,
            );
        }
        if !search.found.is_null() {
            return Some(search.found);
        }
        thread::sleep(Duration::from_millis(80));
    }
    None
}

#[tauri::command]
pub(crate) fn wallpaper_engine_list_projects(
    state: State<'_, WallpaperEngineState>,
    manual_root: Option<String>,
) -> Result<WallpaperEngineLibrarySnapshot, String> {
    let mut projects = Vec::new();
    let mut records = HashMap::new();
    let mut seen = HashSet::new();
    for (container, source_label) in project_containers(manual_root.as_deref()) {
        for project_root in scan_container(&container) {
            let Some((project, record)) = index_project(&project_root, &source_label) else {
                continue;
            };
            if seen.insert(project.id.clone()) {
                records.insert(project.id.clone(), record);
                projects.push(project);
            }
        }
    }
    projects.sort_by(|left, right| {
        right
            .playable
            .cmp(&left.playable)
            .then_with(|| right.engine_playable.cmp(&left.engine_playable))
            .then_with(|| left.title.to_lowercase().cmp(&right.title.to_lowercase()))
    });
    *state
        .projects
        .lock()
        .map_err(|_| "Wallpaper Engine 项目索引不可用".to_string())? = records;
    let engine_executable = discover_engine_executable();
    Ok(WallpaperEngineLibrarySnapshot {
        count: projects.len(),
        projects,
        engine_available: engine_executable.is_some(),
        engine_executable: engine_executable
            .as_ref()
            .and_then(|path| path.file_name())
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub(crate) async fn wallpaper_engine_start_scene(
    window: Window,
    state: State<'_, WallpaperEngineState>,
    project_id: String,
) -> Result<WallpaperEngineSceneStatus, String> {
    #[cfg(not(windows))]
    {
        let _ = (window, state, project_id);
        Err("Wallpaper Engine Scene 仅支持 Windows".to_string())
    }
    #[cfg(windows)]
    {
        let record = state
            .projects
            .lock()
            .map_err(|_| "壁纸库不可用")?
            .get(project_id.trim())
            .cloned()
            .ok_or("请先重新扫描 Wallpaper Engine 壁纸库")?;
        if record.scene_package.is_none() {
            return Err("所选项目不是 Scene 壁纸".into());
        }
        let host = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        let size = window.inner_size().map_err(|e| e.to_string())?;
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let runtime = state.runtime.clone();
        let request = runtime.generation.fetch_add(1, Ordering::AcqRel) + 1;
        tauri::async_runtime::spawn_blocking(move || {
            let _operation = runtime.operation.lock().map_err(|_| "壁纸会话不可用")?;
            let current = || runtime.generation.load(Ordering::Acquire) == request;
            if !current() {
                return Err("壁纸启动已取消".into());
            }
            if let Some(previous) = runtime.session.lock().map_err(|_| "壁纸会话不可用")?.take()
            {
                close_scene_session(previous);
            }
            let executable =
                discover_engine_executable().ok_or("未找到已安装的 Wallpaper Engine")?;
            let executable = runtime::ensure_engine_ready(&executable, &current)?;
            if !current() {
                return Err("壁纸启动已取消".into());
            }
            let session_id = uuid::Uuid::new_v4().simple().to_string();
            let location = format!("Mono Wallpaper {session_id}");
            let project_file = record.project_file.to_string_lossy().to_string();
            run_engine_control(
                &executable,
                &[
                    "-control",
                    "openWallpaper",
                    "-file",
                    &project_file,
                    "-playInWindow",
                    &location,
                    "-width",
                    &size.width.max(64).to_string(),
                    "-height",
                    &size.height.max(64).to_string(),
                    "-x",
                    &position.x.to_string(),
                    "-y",
                    &position.y.to_string(),
                    "-borderless",
                ],
            )?;
            let result = (|| {
                let deadline = Instant::now() + Duration::from_secs(15);
                let source = loop {
                    if !current() {
                        return Err("壁纸启动已取消".to_string());
                    }
                    if let Some(source) =
                        find_window_by_title(&location, Duration::from_millis(100))
                    {
                        break source;
                    }
                    if Instant::now() >= deadline {
                        return Err("Wallpaper Engine 场景窗口启动超时".into());
                    }
                };
                run_engine_control(
                    &executable,
                    &[
                        "-control",
                        "applyProperties",
                        "-properties",
                        r#"RAW~({"volume":0})~END"#,
                        "-location",
                        &location,
                    ],
                )?;
                let surface = surface::Surface::start(host, source as isize, location.clone())?;
                if !current() {
                    return Err("壁纸启动已取消".into());
                }
                let session = WallpaperEngineSession {
                    id: project_id.clone(),
                    session_id: session_id.clone(),
                    location: location.clone(),
                    executable: executable.clone(),
                    surface,
                };
                *runtime.session.lock().map_err(|_| "壁纸会话不可用")? = Some(session);
                Ok(WallpaperEngineSceneStatus {
                    active: true,
                    project_id,
                    session_id,
                })
            })();
            if result.is_err() {
                close_scene_location(&executable, &location);
            }
            result
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

fn scene_status(state: &WallpaperEngineState) -> Result<WallpaperEngineSceneStatus, String> {
    let session = state.runtime.session.lock().map_err(|_| "壁纸会话不可用")?;
    let mut status = WallpaperEngineSceneStatus {
        active: false,
        project_id: String::new(),
        session_id: String::new(),
    };
    if let Some(session) = session.as_ref() {
        status.project_id = session.id.clone();
        status.session_id = session.session_id.clone();
        #[cfg(windows)]
        {
            status.active = session.surface.alive.load(Ordering::Acquire);
        }
    }
    Ok(status)
}

#[tauri::command]
pub(crate) fn wallpaper_engine_scene_status(
    state: State<'_, WallpaperEngineState>,
) -> Result<WallpaperEngineSceneStatus, String> {
    scene_status(&state)
}

#[tauri::command]
pub(crate) async fn wallpaper_engine_stop_scene(
    state: State<'_, WallpaperEngineState>,
    session_id: Option<String>,
) -> Result<WallpaperEngineSceneStatus, String> {
    let runtime = state.runtime.clone();
    // A stale client's targeted stop must not cancel a newer selection.
    if session_id.is_none() {
        runtime.generation.fetch_add(1, Ordering::AcqRel);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let _operation = runtime.operation.lock().map_err(|_| "壁纸会话不可用")?;
        let previous = {
            let mut session = runtime.session.lock().map_err(|_| "壁纸会话不可用")?;
            if session_id
                .as_ref()
                .is_some_and(|id| session.as_ref().is_none_or(|s| &s.session_id != id))
            {
                return Ok(WallpaperEngineSceneStatus {
                    active: session.is_some(),
                    project_id: session.as_ref().map(|s| s.id.clone()).unwrap_or_default(),
                    session_id: session
                        .as_ref()
                        .map(|s| s.session_id.clone())
                        .unwrap_or_default(),
                });
            }
            session.take()
        };
        let project_id = previous.as_ref().map(|s| s.id.clone()).unwrap_or_default();
        if let Some(session) = previous {
            close_scene_session(session);
        }
        Ok(WallpaperEngineSceneStatus {
            active: false,
            project_id,
            session_id: String::new(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// The random session URL exposes only this background's latest sampler frame,
// never a desktop capture or a caller-supplied HWND/path.
pub(crate) fn frame_response(
    app: &tauri::AppHandle,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut status = 404;
    #[cfg(windows)]
    if request.method() == tauri::http::Method::GET {
        let token = request.uri().path().trim_matches('/');
        let crop = sampling::CropSpec::from_query(request.uri().query());
        if let Some(state) = app.try_state::<WallpaperEngineState>() {
            if let Ok(session) = state.runtime.session.lock() {
                if let Some(session) = session
                    .as_ref()
                    .filter(|s| s.session_id == token && s.surface.alive.load(Ordering::Acquire))
                {
                    if let Ok(mut sample) = session.surface.sample.lock() {
                        if sample.crop != crop {
                            sample.crop = crop;
                            sample.bytes.clear();
                        }
                        sample.requested = Some(Instant::now());
                        bytes.clone_from(&sample.bytes);
                        status = if bytes.is_empty() { 204 } else { 200 };
                    }
                }
            }
        }
    }
    tauri::http::Response::builder()
        .status(status)
        .header("Content-Type", "image/jpeg")
        .header("Cache-Control", "no-store")
        .header("Access-Control-Allow-Origin", "*")
        .body(bytes)
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "mono-wallpaper-engine-{name}-{}",
            uuid::Uuid::new_v4()
        ))
    }

    #[test]
    fn indexes_direct_image_project() {
        let root = test_directory("image");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("cover.png"), b"image").unwrap();
        fs::write(
            root.join("project.json"),
            r#"{"type":"image","title":"测试壁纸","file":"cover.png"}"#,
        )
        .unwrap();

        let (project, record) = index_project(&root, "测试").expect("project should be indexed");
        assert_eq!(project.project_type, "image");
        assert_eq!(project.media_type, "image");
        assert!(project.playable);
        assert!(!project.engine_playable);
        assert_eq!(record.scene_package, None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_files_outside_project_root() {
        let parent = test_directory("escape");
        let root = parent.join("project");
        fs::create_dir_all(&root).unwrap();
        fs::write(parent.join("outside.png"), b"image").unwrap();
        fs::write(
            root.join("project.json"),
            r#"{"type":"image","file":"../outside.png"}"#,
        )
        .unwrap();

        assert!(index_project(&root, "测试").is_none());

        fs::remove_dir_all(parent).unwrap();
    }

    #[test]
    fn scene_requires_pkgv_header() {
        let root = test_directory("scene");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("scene.pkg"), b"xxxxPKGV0001").unwrap();
        fs::write(
            root.join("project.json"),
            r#"{"type":"scene","file":"scene.pkg"}"#,
        )
        .unwrap();

        let (project, record) = index_project(&root, "测试").expect("scene should be indexed");
        assert!(project.engine_playable);
        assert!(record.scene_package.is_some());

        fs::write(root.join("scene.pkg"), b"not-a-scene").unwrap();
        assert!(index_project(&root, "测试").is_none());

        fs::remove_dir_all(root).unwrap();
    }
}
