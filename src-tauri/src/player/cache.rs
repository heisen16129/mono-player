use chrono::{Days, Local};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const MONO_CACHE_DIR: &str = "mono-cache";
const ONLINE_AUDIO_CACHE_DIR: &str = "online-audio-cache";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheDirSnapshot {
    pub(crate) cache_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheCleanupSnapshot {
    pub(crate) removed_files: usize,
    pub(crate) removed_bytes: u64,
    pub(crate) remaining_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheStatusSnapshot {
    pub(crate) files: usize,
    pub(crate) bytes: u64,
    pub(crate) path: String,
    pub(crate) directories: Vec<CacheDirectorySnapshot>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheDirectorySnapshot {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) bytes: u64,
    pub(crate) files: usize,
}

pub(crate) fn system_temp_cache_dir() -> PathBuf {
    std::env::temp_dir().join("mono-player")
}

pub(crate) fn mono_cache_dir(cache_dir: &Path) -> PathBuf {
    cache_dir.join(MONO_CACHE_DIR)
}

pub(crate) fn online_audio_cache_dir(cache_dir: &Path) -> PathBuf {
    mono_cache_dir(cache_dir).join(ONLINE_AUDIO_CACHE_DIR)
}

pub(crate) fn start_daily_cache_cleanup(cache_dir: Arc<Mutex<PathBuf>>) {
    thread::spawn(move || loop {
        thread::sleep(duration_until_next_midnight());
        let Ok(cache_dir) = cache_dir.lock().map(|path| path.clone()) else {
            continue;
        };
        cleanup_online_audio_cache_files(&cache_dir, None);
    });
}

pub(crate) fn cleanup_online_audio_cache_files(
    cache_dir: &PathBuf,
    active_cache_path: Option<&PathBuf>,
) {
    let online_audio_cache_dir = online_audio_cache_dir(cache_dir);
    for entry in cache_entries(
        &online_audio_cache_dir,
        &active_cache_path.into_iter().cloned().collect::<Vec<_>>(),
    ) {
        let _ = fs::remove_file(entry.path);
    }
}

pub(crate) fn active_cache_paths() -> Vec<PathBuf> {
    Vec::new()
}

pub(crate) fn clear_cache_files(
    cache_dir: &PathBuf,
    active_cache_paths: &[PathBuf],
) -> CacheCleanupSnapshot {
    let mut removed_files = 0;
    let mut removed_bytes = 0;

    for entry in cache_entries(&mono_cache_dir(cache_dir), active_cache_paths) {
        if is_custom_cover(&entry.path) {
            continue;
        }
        if fs::remove_file(&entry.path).is_ok() {
            removed_files += 1;
            removed_bytes += entry.size;
        }
    }

    CacheCleanupSnapshot {
        removed_files,
        removed_bytes,
        remaining_bytes: cache_entries(&mono_cache_dir(cache_dir), active_cache_paths)
            .into_iter()
            .map(|entry| entry.size)
            .sum(),
    }
}

pub(crate) fn prune_cache_files(
    cache_dir: &PathBuf,
    active_cache_paths: &[PathBuf],
    max_bytes: u64,
) -> CacheCleanupSnapshot {
    let mut entries = cache_entries(&mono_cache_dir(cache_dir), active_cache_paths);
    let mut total_bytes = entries.iter().map(|entry| entry.size).sum::<u64>();
    let mut removed_files = 0;
    let mut removed_bytes = 0;

    entries.sort_by_key(|entry| entry.modified);
    for entry in entries {
        if total_bytes <= max_bytes {
            break;
        }
        if is_custom_cover(&entry.path) {
            continue;
        }
        if fs::remove_file(&entry.path).is_ok() {
            removed_files += 1;
            removed_bytes += entry.size;
            total_bytes = total_bytes.saturating_sub(entry.size);
        }
    }

    CacheCleanupSnapshot {
        removed_files,
        removed_bytes,
        remaining_bytes: total_bytes,
    }
}

pub(crate) fn cache_status(
    cache_dir: &PathBuf,
    active_cache_paths: &[PathBuf],
) -> CacheStatusSnapshot {
    let root = mono_cache_dir(cache_dir);
    let entries = cache_entries(&root, active_cache_paths);
    let mut groups = std::collections::BTreeMap::<String, (usize, u64)>::new();
    for name in [
        "online-audio-cache",
        "plugin-lyrics",
        "plugin-covers",
        "cover-thumbnails",
        "cover-originals",
        "plugin-wasm",
    ] {
        groups.insert(name.to_string(), (0, 0));
    }
    if let Ok(children) = fs::read_dir(&root) {
        for child in children.flatten() {
            if child.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                groups
                    .entry(child.file_name().to_string_lossy().into_owned())
                    .or_default();
            }
        }
    }
    if let Ok(canonical_root) = root.canonicalize() {
        for entry in &entries {
            if let Ok(relative) = entry.path.strip_prefix(&canonical_root) {
                let name = if relative.components().count() > 1 {
                    relative
                        .components()
                        .next()
                        .unwrap()
                        .as_os_str()
                        .to_string_lossy()
                        .into_owned()
                } else {
                    ".".to_string()
                };
                let group = groups.entry(name).or_default();
                group.0 += 1;
                group.1 += entry.size;
            }
        }
    }
    CacheStatusSnapshot {
        files: entries.len(),
        bytes: entries.iter().map(|entry| entry.size).sum(),
        path: root.to_string_lossy().into_owned(),
        directories: groups
            .into_iter()
            .map(|(name, (files, bytes))| CacheDirectorySnapshot {
                path: if name == "." {
                    root.clone()
                } else {
                    root.join(&name)
                }
                .to_string_lossy()
                .into_owned(),
                name,
                files,
                bytes,
            })
            .collect(),
    }
}

#[cfg(test)]
mod breakdown_tests {
    use super::*;

    #[test]
    fn cleaning_preserves_custom_covers_only() {
        let root =
            std::env::temp_dir().join(format!("mono-cover-clean-test-{}", uuid::Uuid::new_v4()));
        let cache = mono_cache_dir(&root);
        let protected = [
            "cover-originals/custom-test.jpg",
            "cover-thumbnails/custom-test.jpg",
        ];
        for relative in protected {
            let path = cache.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, b"cover").unwrap();
        }
        let disposable = cache.join("cover-edits/old.jpg");
        fs::create_dir_all(disposable.parent().unwrap()).unwrap();
        fs::write(&disposable, b"cache").unwrap();
        assert_eq!(prune_cache_files(&root, &[], 0).removed_files, 1);
        fs::write(&disposable, b"cache").unwrap();
        assert_eq!(clear_cache_files(&root, &[]).removed_files, 1);
        for relative in protected {
            assert!(cache.join(relative).is_file());
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn directory_totals_include_nested_and_unknown_caches() {
        let root = std::env::temp_dir().join(format!(
            "mono-cache-breakdown-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let cache = mono_cache_dir(&root);
        fs::create_dir_all(cache.join("plugin-lyrics/nested")).unwrap();
        fs::create_dir_all(cache.join("extra-cache")).unwrap();
        fs::write(cache.join("plugin-lyrics/nested/lyrics.txt"), b"hello").unwrap();
        fs::write(cache.join("extra-cache/data"), b"1234567").unwrap();
        fs::write(cache.join("other"), b"abc").unwrap();
        let status = cache_status(&root, &[]);
        assert_eq!(status.bytes, 15);
        assert_eq!(status.files, 3);
        assert_eq!(
            status
                .directories
                .iter()
                .map(|item| item.bytes)
                .sum::<u64>(),
            status.bytes
        );
        for (name, bytes) in [
            ("plugin-lyrics", 5),
            ("extra-cache", 7),
            (".", 3),
            ("cover-originals", 0),
        ] {
            assert_eq!(
                status
                    .directories
                    .iter()
                    .find(|item| item.name == name)
                    .unwrap()
                    .bytes,
                bytes
            );
        }
        fs::remove_dir_all(root).unwrap();
    }
}

fn is_custom_cover(path: &Path) -> bool {
    let directory = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str());
    matches!(directory, Some("cover-originals" | "cover-thumbnails"))
        && path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with("custom-"))
            .unwrap_or(false)
}

struct CacheEntry {
    path: PathBuf,
    size: u64,
    modified: SystemTime,
}

fn cache_entries(cache_dir: &PathBuf, active_cache_paths: &[PathBuf]) -> Vec<CacheEntry> {
    cache_files_in_dir(cache_dir, active_cache_paths)
}

fn cache_files_in_dir(cache_dir: &PathBuf, active_cache_paths: &[PathBuf]) -> Vec<CacheEntry> {
    let Ok(cache_root) = cache_dir.canonicalize() else {
        return Vec::new();
    };
    cache_files_in_dir_inner(&cache_root, &cache_root, active_cache_paths)
}

fn cache_files_in_dir_inner(
    cache_root: &PathBuf,
    cache_dir: &PathBuf,
    active_cache_paths: &[PathBuf],
) -> Vec<CacheEntry> {
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return Vec::new();
    };

    let mut cache_entries = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(canonical_path) = path.canonicalize() else {
            continue;
        };
        if !canonical_path.starts_with(cache_root) {
            continue;
        }
        if active_cache_paths
            .iter()
            .any(|active| active == &canonical_path || active == &path)
        {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_dir() {
            cache_entries.extend(cache_files_in_dir_inner(
                cache_root,
                &canonical_path,
                active_cache_paths,
            ));
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        cache_entries.push(CacheEntry {
            path: canonical_path,
            size: metadata.len(),
            modified: metadata.modified().unwrap_or(UNIX_EPOCH),
        });
    }
    cache_entries
}

fn duration_until_next_midnight() -> Duration {
    let now = Local::now();
    let tomorrow = now
        .date_naive()
        .checked_add_days(Days::new(1))
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .and_then(|midnight| midnight.and_local_timezone(Local).single());

    let Some(next_midnight) = tomorrow else {
        return Duration::from_secs(24 * 60 * 60);
    };

    let seconds = (next_midnight - now).num_seconds().max(60) as u64;
    Duration::from_secs(seconds)
}
