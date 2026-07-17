use crate::api_response::ApiResponse;
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub(crate) fn open_track_in_folder(path: String) -> ApiResponse<()> {
    ApiResponse::from_empty_result(open_track_in_folder_inner(path))
}

fn open_track_in_folder_inner(path: String) -> Result<(), String> {
    let track_path = PathBuf::from(path.trim());
    if !track_path.is_file() {
        return Err("歌曲文件不存在。".to_string());
    }
    let track_path = track_path.canonicalize().unwrap_or(track_path);

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(&track_path)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&track_path)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let Some(parent) = track_path.parent() else {
            return Err("无法打开歌曲所在文件夹。".to_string());
        };

        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }
}
