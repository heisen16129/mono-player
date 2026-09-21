use super::environment::EnvironmentState;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

pub(super) fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
        // A running Mono process may predate a WinGet install and have a stale PATH.
        // Add only the FFmpeg directory to this child process, without changing system settings.
        if let Some(directory) = winget_ffmpeg_directory() {
            let mut paths = vec![directory];
            paths.extend(std::env::split_paths(
                &std::env::var_os("PATH").unwrap_or_default(),
            ));
            if let Ok(path) = std::env::join_paths(paths) {
                command.env("PATH", path);
            }
        }
    }
    command
}

#[cfg(windows)]
fn winget_ffmpeg_directory() -> Option<PathBuf> {
    for base in [
        std::env::var_os("LOCALAPPDATA")
            .map(|p| PathBuf::from(p).join("Microsoft/WinGet/Packages")),
        std::env::var_os("ProgramFiles").map(|p| PathBuf::from(p).join("WinGet/Packages")),
    ]
    .into_iter()
    .flatten()
    {
        let Ok(packages) = fs::read_dir(base) else {
            continue;
        };
        for package in packages
            .flatten()
            .filter(|p| p.file_name().to_string_lossy().starts_with("Gyan.FFmpeg_"))
        {
            for entry in walkdir::WalkDir::new(package.path())
                .max_depth(3)
                .into_iter()
                .filter_map(Result::ok)
            {
                if entry.file_type().is_file()
                    && entry
                        .file_name()
                        .to_string_lossy()
                        .eq_ignore_ascii_case("ffmpeg.exe")
                {
                    return entry.path().parent().map(Path::to_path_buf);
                }
            }
        }
    }
    None
}

pub(super) fn stop_child(child: &mut Child) {
    if !matches!(child.try_wait(), Ok(None)) {
        return;
    }
    #[cfg(windows)]
    {
        let _ = hidden_command("taskkill.exe")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

pub(super) fn run_command(
    state: &EnvironmentState,
    mut command: Command,
    timeout: Duration,
) -> Result<(), String> {
    state.check_cancelled()?;
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stderr = child.stderr.take().expect("piped stderr");
    let reader = thread::spawn(move || super::runtime::read_tail(stderr));
    *state.0.child.lock().unwrap() = Some(child);
    let started = Instant::now();
    let result = loop {
        let mut current = state.0.child.lock().unwrap();
        let child = current.as_mut().unwrap();
        if state.check_cancelled().is_err() || started.elapsed() > timeout {
            stop_child(child);
            break Err("准备已取消或超时，请重试。".to_string());
        }
        match child.try_wait() {
            Ok(Some(exit)) => break Ok(exit.success()),
            Err(error) => {
                stop_child(child);
                break Err(error.to_string());
            }
            Ok(None) => {}
        }
        drop(current);
        thread::sleep(Duration::from_millis(150));
    };
    *state.0.child.lock().unwrap() = None;
    let details = reader.join().unwrap_or_default();
    state.check_cancelled()?;
    match result {
        Ok(true) => Ok(()),
        Ok(false) => Err(format!("组件准备未完成，可检查网络后重试。\n{details}")),
        Err(error) => Err(error),
    }
}

fn uv_asset() -> Result<(&'static str, &'static str), String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Ok(("uv-x86_64-pc-windows-msvc", "zip")),
        ("macos", "aarch64") => Ok(("uv-aarch64-apple-darwin", "tar.gz")),
        ("macos", "x86_64") => Ok(("uv-x86_64-apple-darwin", "tar.gz")),
        ("linux", "x86_64") => Ok(("uv-x86_64-unknown-linux-gnu", "tar.gz")),
        _ => Err("当前系统暂不支持自动准备，请使用已有的分离环境。".into()),
    }
}

pub(super) fn download_uv(state: &EnvironmentState, root: &Path) -> Result<PathBuf, String> {
    let (asset, extension) = uv_asset()?;
    let tools_dir = root.join("tools");
    fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;
    let uv = if cfg!(windows) {
        tools_dir.join("uv.exe")
    } else {
        tools_dir.join(asset).join("uv")
    };
    if uv.is_file() {
        let mut command = hidden_command(&uv);
        command.arg("--version");
        if run_command(state, command, Duration::from_secs(10)).is_ok() {
            return Ok(uv);
        }
    }
    state.check_cancelled()?;
    state.message("正在下载环境安装组件…");
    let base =
        format!("https://github.com/astral-sh/uv/releases/download/0.10.7/{asset}.{extension}");
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let expected = client
        .get(format!("{base}.sha256"))
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.text())
        .map_err(|e| format!("无法获取组件校验信息：{e}"))?;
    let checksum = expected.split_whitespace().next().unwrap_or("");
    if checksum.len() != 64 || !checksum.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("组件校验信息无效，请稍后重试。".into());
    }
    state.check_cancelled()?;
    let mut response = client
        .get(&base)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?;
    let archive = tools_dir.join(format!("uv.{extension}"));
    let mut file = fs::File::create(&archive).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    let started = Instant::now();
    let mut downloaded = 0u64;
    let total = response.content_length();
    loop {
        state.check_cancelled()?;
        if started.elapsed() > Duration::from_secs(900) {
            return Err("组件下载超时，请检查网络后重试。".into());
        }
        let count = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        file.write_all(&buffer[..count])
            .map_err(|e| e.to_string())?;
        downloaded += count as u64;
        let progress = match total {
            Some(total) => format!(
                "{:.1} / {:.1} MB",
                downloaded as f64 / 1048576.0,
                total as f64 / 1048576.0
            ),
            None => format!("{:.1} MB", downloaded as f64 / 1048576.0),
        };
        state.message(&format!("正在下载环境安装组件… {progress}"));
    }
    drop(file);
    if format!("{:x}", hasher.finalize()) != checksum.to_ascii_lowercase() {
        let _ = fs::remove_file(&archive);
        return Err("下载的组件校验失败，请重试。".into());
    }
    let mut extract = hidden_command("tar");
    extract.arg("-xf").arg(&archive).arg("-C").arg(&tools_dir);
    run_command(state, extract, Duration::from_secs(60))?;
    let _ = fs::remove_file(&archive);
    let mut check = hidden_command(&uv);
    check.arg("--version");
    run_command(state, check, Duration::from_secs(10))?;
    Ok(uv)
}
