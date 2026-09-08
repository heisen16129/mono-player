use std::{
    fs,
    path::{Path, PathBuf},
};

fn engine_directory(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_str()?;
    if !name.eq_ignore_ascii_case("wallpaper32.exe")
        && !name.eq_ignore_ascii_case("wallpaper64.exe")
    {
        return None;
    }
    // Resolve separators, extended prefixes and filesystem aliases before comparing.
    let canonical = fs::canonicalize(path).ok()?;
    if !canonical.is_file() {
        return None;
    }
    Some(canonical.parent()?.to_string_lossy().to_lowercase())
}

pub(super) fn select_running_engine(
    expected: &Path,
    running: &[PathBuf],
) -> Result<Option<PathBuf>, String> {
    if running.is_empty() {
        return Ok(None);
    }
    let expected_directory = engine_directory(expected).ok_or_else(|| {
        format!(
            "无法核实扫描到的 Wallpaper Engine 程序：{}",
            expected.display()
        )
    })?;
    if let Some(actual) = running
        .iter()
        .find(|path| engine_directory(path).as_ref() == Some(&expected_directory))
    {
        return Ok(Some(actual.clone()));
    }
    Err(format!(
        "正在运行的 Wallpaper Engine 与扫描到的安装目录不一致。扫描程序：{}；运行程序：{}",
        expected.display(),
        running
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>()
            .join("；")
    ))
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::{
        fs,
        sync::atomic::{AtomicU64, Ordering},
    };

    static NEXT: AtomicU64 = AtomicU64::new(0);

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "mono-we-paths-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(root.join("wallpaper_engine")).unwrap();
            for name in ["wallpaper32.exe", "wallpaper64.exe", "unrelated.exe"] {
                fs::write(
                    root.join("wallpaper_engine").join(name),
                    b"test fixture, not executable",
                )
                .unwrap();
            }
            Self(root)
        }

        fn engine(&self, name: &str) -> PathBuf {
            self.0.join("wallpaper_engine").join(name)
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn accepts_steam_forward_slashes_and_process_backslashes() {
        let f = Fixture::new();
        let actual = f.engine("wallpaper64.exe");
        let scanned = PathBuf::from(actual.to_string_lossy().replace('\\', "/"));
        assert_eq!(
            select_running_engine(&scanned, &[actual.clone()]).unwrap(),
            Some(actual)
        );
    }

    #[test]
    fn accepts_case_and_extended_path_prefixes() {
        let f = Fixture::new();
        let actual = f.engine("wallpaper64.exe");
        let scanned = PathBuf::from(
            fs::canonicalize(&actual)
                .unwrap()
                .to_string_lossy()
                .to_uppercase(),
        );
        assert_eq!(
            select_running_engine(&scanned, &[actual.clone()]).unwrap(),
            Some(actual)
        );
    }

    #[test]
    fn reuses_running_32_bit_engine_from_the_same_installation() {
        let f = Fixture::new();
        let actual = f.engine("wallpaper32.exe");
        assert_eq!(
            select_running_engine(&f.engine("wallpaper64.exe"), &[actual.clone()]).unwrap(),
            Some(actual)
        );
    }

    #[test]
    fn checks_all_processes_before_reporting_a_mismatch() {
        let f = Fixture::new();
        let other = Fixture::new();
        let actual = f.engine("wallpaper64.exe");
        assert_eq!(
            select_running_engine(&actual, &[other.engine("wallpaper64.exe"), actual.clone()])
                .unwrap(),
            Some(actual)
        );
    }

    #[test]
    fn rejects_a_different_installation_and_reports_both_paths() {
        let f = Fixture::new();
        let other = Fixture::new();
        let expected = f.engine("wallpaper64.exe");
        let actual = other.engine("wallpaper64.exe");
        let error = select_running_engine(&expected, &[actual.clone()]).unwrap_err();
        assert!(error.contains(expected.to_str().unwrap()));
        assert!(error.contains(actual.to_str().unwrap()));
    }

    #[test]
    fn rejects_other_executable_names_in_the_same_directory() {
        let f = Fixture::new();
        assert!(
            select_running_engine(&f.engine("wallpaper64.exe"), &[f.engine("unrelated.exe")])
                .is_err()
        );
    }

    #[test]
    fn no_running_process_is_not_a_mismatch() {
        let f = Fixture::new();
        assert_eq!(
            select_running_engine(&f.engine("wallpaper64.exe"), &[]).unwrap(),
            None
        );
    }
}
