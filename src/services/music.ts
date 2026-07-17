import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { CoverImage, CustomTheme, LyricLine, SystemThemeState, Track, WallpaperThemeColor } from '../types/music';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

export interface WorkerDiagnostic {
  worker: string;
  running: boolean;
  pid: number | null;
  startedAtMs: number | null;
  error: string | null;
  restartPolicy?: string | null;
}

export interface WorkerDiagnosticsSnapshot {
  workers: WorkerDiagnostic[];
}

export interface ScanMusicDirResult {
  tracks: Track[];
  addedTracks: Track[];
  addedTrackIds: number[];
}

type RawScanMusicDirResult = Track[] | {
  tracks?: Track[];
  addedTracks?: Track[];
  addedTrackIds?: number[];
};

export interface UpdateTrackMetadataRequest {
  id: number;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
}

export interface UpdateTrackMetadataResult {
  id: number;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
}

export interface UpdateTrackCoverRequest {
  path: string;
  coverPath: string;
}

export interface RefreshTrackDurationRequest {
  id: number;
  path: string;
}

export interface RefreshTrackDurationResult {
  id: number;
  duration: number;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function listTracks(): Promise<Track[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invoke<Track[]>('list_tracks');
}

export function listLatestAddedTracks(): Promise<Track[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invoke<Track[]>('list_latest_added_tracks');
}

export function removeMusicDir(path: string): Promise<Track[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invoke<Track[]>('remove_music_dir', { path });
}

export function updateTrackMetadata(request: UpdateTrackMetadataRequest): Promise<UpdateTrackMetadataResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中更改歌曲元数据。'));
  }

  return invoke<UpdateTrackMetadataResult>('update_track_metadata', { request });
}

export function updateTrackCover(request: UpdateTrackCoverRequest): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中更换歌曲封面。'));
  }

  return invoke('update_track_cover', { request });
}

export function refreshTrackDuration(request: RefreshTrackDurationRequest): Promise<RefreshTrackDurationResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中重新读取歌曲时长。'));
  }

  return invoke<RefreshTrackDurationResult>('refresh_track_duration', { request });
}

export function systemWorkerHealth(): Promise<WorkerDiagnosticsSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ workers: [] });
  }

  return invoke<WorkerDiagnosticsSnapshot>('system_worker_health');
}

export async function scanMusicDir(path: string): Promise<ScanMusicDirResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中扫描本地音乐目录。'));
  }

  const result = await invoke<RawScanMusicDirResult>('scan_music_dir', { path });
  if (Array.isArray(result)) {
    return { tracks: result, addedTracks: [], addedTrackIds: [] };
  }

  return {
    tracks: Array.isArray(result.tracks) ? result.tracks : [],
    addedTracks: Array.isArray(result.addedTracks) ? result.addedTracks : [],
    addedTrackIds: Array.isArray(result.addedTrackIds) ? result.addedTrackIds : [],
  };
}

export function cancelScanMusicDir(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return Promise.resolve(false);
  }

  return invoke<boolean>('cancel_scan_music_dir');
}

export interface LyricsSourceInput {
  path?: string | null;
  title?: string | null;
  artist?: string | null;
  rawLyrics?: string | null;
  lyricsSourceUrl?: string | null;
  lyricsFormat?: string | null;
}

export function resolveLyricsSource(track?: LyricsSourceInput | null): Promise<LyricLine[]> {
  if (!isTauriRuntime() || !track) {
    return Promise.resolve([]);
  }

  const lyrics = normalizeTrackLyrics(track as Track);
  return invoke<LyricLine[]>('resolve_lyrics_source', {
    lyrics: {
      rawLyrics: lyrics?.rawLyrics ?? track.rawLyrics ?? null,
      sourceUrl: lyrics?.lyricsUrl ?? track.lyricsSourceUrl ?? null,
      localPath: track.path ?? null,
      title: track.title ?? null,
      artist: track.artist ?? null,
      format: lyrics?.format ?? track.lyricsFormat ?? null,
    },
  });
}

export function readCover(path: string): Promise<CoverImage | null> {
  if (!isTauriRuntime() || !path) {
    return Promise.resolve(null);
  }

  return invoke<CoverImage | null>('read_cover', { path });
}

export function readCoverThumbnail(path: string): Promise<CoverImage | null> {
  if (!isTauriRuntime() || !path) {
    return Promise.resolve(null);
  }

  return invoke<CoverImage | null>('read_cover_thumbnail', { path });
}

export function clearCoverThumbnailCache(path: string): Promise<void> {
  if (!isTauriRuntime() || !path) {
    return Promise.resolve();
  }

  return invoke('clear_cover_thumbnail_cache', { path });
}

export function getWallpaperThemeColor(): Promise<WallpaperThemeColor | null> {
  if (!isTauriRuntime()) {
    return Promise.resolve(null);
  }

  return invoke<WallpaperThemeColor>('get_wallpaper_theme_color');
}

export function getSystemThemeState(): Promise<SystemThemeState> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ mode: 'light', appsUseLightTheme: true, systemUsesLightTheme: true, wallpaperColor: null });
  }

  return invoke<SystemThemeState>('get_system_theme_state');
}

export function importThemeFolder(path: string): Promise<CustomTheme> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中导入主题。'));
  }

  return invoke<CustomTheme>('import_theme_folder', { path });
}

export function openTrackInFolder(path: string): Promise<void> {
  if (!isTauriRuntime() || !path) {
    return Promise.resolve();
  }

  return invoke('open_track_in_folder', { path });
}

export function hideMainWindowToTray(): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invoke('hide_main_window_to_tray');
}

export function exitApp(): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invoke('exit_app');
}

export function updateTrayNowPlaying(title: string): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invoke('update_tray_now_playing', { title });
}

export function toAudioSource(path: string): string {
  return convertFileSrc(path);
}
