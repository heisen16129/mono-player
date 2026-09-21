use std::path::{Path, PathBuf};

pub(super) fn ffmpeg(bundle: &Path) -> PathBuf {
    let filename = if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let packaged = bundle.join(filename);
    if packaged.is_file() {
        return packaged;
    }
    if let Some(path) = std::env::var_os("PATH") {
        if let Some(found) = std::env::split_paths(&path)
            .map(|p| p.join(filename))
            .find(|p| p.is_file())
        {
            return found;
        }
    }
    #[cfg(windows)]
    for root in [
        std::env::var_os("LOCALAPPDATA")
            .map(|p| PathBuf::from(p).join("Microsoft/WinGet/Packages")),
        std::env::var_os("ProgramFiles").map(|p| PathBuf::from(p).join("WinGet/Packages")),
    ]
    .into_iter()
    .flatten()
    {
        if let Ok(packages) = std::fs::read_dir(root) {
            for package in packages
                .flatten()
                .filter(|p| p.file_name().to_string_lossy().starts_with("Gyan.FFmpeg_"))
            {
                if let Some(found) = walkdir::WalkDir::new(package.path())
                    .max_depth(3)
                    .into_iter()
                    .filter_map(Result::ok)
                    .find(|e| {
                        e.file_type().is_file()
                            && e.file_name()
                                .to_string_lossy()
                                .eq_ignore_ascii_case(filename)
                    })
                {
                    return found.into_path();
                }
            }
        }
    }
    filename.into()
}
