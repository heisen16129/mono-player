use super::paths::select_running_engine;
use std::{
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
use windows::{
    core::PWSTR,
    Win32::{
        Foundation::CloseHandle,
        System::{Diagnostics::ToolHelp::*, Threading::*},
    },
};

fn running_engine(executable: &Path) -> Result<Option<PathBuf>, String> {
    unsafe {
        let snapshot =
            CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).map_err(|e| e.to_string())?;
        let result = (|| {
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            if Process32FirstW(snapshot, &mut entry).is_err() {
                return Ok(None);
            }
            let mut running = Vec::new();
            loop {
                let end = entry
                    .szExeFile
                    .iter()
                    .position(|c| *c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..end]).to_lowercase();
                if name == "wallpaper64.exe" || name == "wallpaper32.exe" {
                    let process = OpenProcess(
                        PROCESS_QUERY_LIMITED_INFORMATION,
                        false,
                        entry.th32ProcessID,
                    )
                    .map_err(|_| {
                        "无法检查 Wallpaper Engine 进程，请以相同权限运行两个程序".to_string()
                    })?;
                    let mut buffer = [0u16; 32768];
                    let mut length = buffer.len() as u32;
                    let read = QueryFullProcessImageNameW(
                        process,
                        PROCESS_NAME_WIN32,
                        PWSTR(buffer.as_mut_ptr()),
                        &mut length,
                    );
                    let _ = CloseHandle(process);
                    read.map_err(|e| e.to_string())?;
                    running.push(PathBuf::from(String::from_utf16_lossy(
                        &buffer[..length as usize],
                    )));
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
            select_running_engine(executable, &running).map_err(|error| {
                eprintln!("[Wallpaper Engine][路径校验] {error}");
                error
            })
        })();
        let _ = CloseHandle(snapshot);
        result
    }
}

fn control_ready(executable: &Path) -> bool {
    let Ok(mut child) = Command::new(executable)
        .current_dir(executable.parent().unwrap())
        .args(["-control", "getWallpaper", "-monitor", "0"])
        .creation_flags(CREATE_NO_WINDOW.0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return false;
    };
    let deadline = Instant::now() + Duration::from_secs(2);
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(status)) => return status.success(),
            Err(_) => return false,
            _ => thread::sleep(Duration::from_millis(40)),
        }
    }
    // This PID belongs to our short-lived read-only control request, not the
    // already running engine or the user's desktop wallpaper session.
    let _ = child.kill();
    let _ = child.wait();
    false
}

pub(super) fn ensure_engine_ready(
    executable: &Path,
    current: &impl Fn() -> bool,
) -> Result<PathBuf, String> {
    if running_engine(executable)?.is_none() {
        return Err(
            "请先启动 Wallpaper Engine 后重试。为避免修改桌面背景，Mono 不会代为启动它"
                .into(),
        );
    }
    let deadline = Instant::now() + Duration::from_secs(20);
    let mut acknowledgements = 0;
    while Instant::now() < deadline && current() {
        let active = running_engine(executable)?;
        if let Some(active) = active.filter(|path| control_ready(path)) {
            acknowledgements += 1;
            if acknowledgements == 2 {
                eprintln!(
                    "[Wallpaper Engine][路径校验] 已确认运行程序。扫描程序：{}；实际程序：{}",
                    executable.display(),
                    active.display()
                );
                return Ok(active);
            }
        } else {
            acknowledgements = 0;
        }
        thread::sleep(Duration::from_millis(180));
    }
    Err(if current() {
        "Wallpaper Engine 控制接口未就绪"
    } else {
        "壁纸启动已取消"
    }
    .into())
}
