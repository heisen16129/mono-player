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
    let entries = cache_entries(&mono_cache_dir(cache_dir), active_cache_paths);
    CacheStatusSnapshot {
        files: entries.len(),
        bytes: entries.into_iter().map(|entry| entry.size).sum(),
    }
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
