import { listen } from '@tauri-apps/api/event';
import { invokeApi } from './api';
import { isTauriRuntime } from './music';
import type { Track } from '../types/music';

const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

export interface RustPlayerState {
  currentPath: string | null;
  position: number;
  isPlaying: boolean;
  duration?: number | null;
  volume: number;
  speed: number;
  spectrumLevels?: number[];
}

export interface RustCacheDirState {
  cacheDir: string;
}

export interface RustAudioOutputDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface RustQueueSnapshot {
  tracks: Track[];
  sources: string[];
  currentSource: string | null;
  currentIndex: number | null;
  playbackMode: string;
}

function emptyQueueSnapshot(playbackMode = 'repeat'): RustQueueSnapshot {
  return { tracks: [], sources: [], currentSource: null, currentIndex: null, playbackMode };
}

export interface RustOutputDeviceFallbackEvent {
  previousDeviceId: string;
}

export interface RustCacheCleanupState {
  removedFiles: number;
  removedBytes: number;
  remainingBytes: number;
}

export interface RustCacheStatusState {
  files: number;
  bytes: number;
}

export function canUseRustAudioBackend(path: string | null | undefined): path is string {
  return Boolean(isTauriRuntime() && path && (!URL_SCHEME_RE.test(path) || isRustPlayableUrl(path)) && !path.startsWith('plugin:'));
}

export function isRustPlayableUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

export function pauseRustBackend(fade = false): Promise<void> {
  return invokeApi<void>('player_pause', { fade });
}

export function resumeRustBackend(): Promise<void> {
  return invokeApi<void>('player_resume');
}

export function stopRustBackend(fade = false): Promise<void> {
  return invokeApi<void>('player_stop', { fade });
}

export function seekRustBackend(seconds: number): Promise<void> {
  return invokeApi<void>('player_seek', { seconds });
}

export function setRustBackendVolume(volume: number): Promise<void> {
  return invokeApi<void>('player_set_volume', { volume });
}

export function setRustBackendSpeed(speed: number): Promise<void> {
  return invokeApi<void>('player_set_speed', { speed });
}

export function getRustBackendSystemTempCacheDir(): Promise<string> {
  if (!isTauriRuntime()) {
    return Promise.resolve('');
  }

  return invokeApi<string>('player_system_temp_cache_dir');
}

export function getRustBackendDefaultCacheDir(): Promise<string> {
  if (!isTauriRuntime()) {
    return Promise.resolve('');
  }

  return invokeApi<string>('player_default_cache_dir');
}

export function setRustBackendCacheDir(cacheDir: string | null): Promise<RustCacheDirState> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ cacheDir: cacheDir ?? '' });
  }

  return invokeApi<RustCacheDirState>('player_set_cache_dir', { cacheDir });
}

export function clearRustBackendCache(): Promise<RustCacheCleanupState> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ removedFiles: 0, removedBytes: 0, remainingBytes: 0 });
  }

  return invokeApi<RustCacheCleanupState>('player_clear_cache');
}

export function pruneRustBackendCache(maxBytes: number): Promise<RustCacheCleanupState> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ removedFiles: 0, removedBytes: 0, remainingBytes: 0 });
  }

  return invokeApi<RustCacheCleanupState>('player_prune_cache', { maxBytes });
}

export function getRustBackendCacheStatus(): Promise<RustCacheStatusState> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ files: 0, bytes: 0 });
  }

  return invokeApi<RustCacheStatusState>('player_cache_status');
}

export function startRustBackendQueue(
  tracks: Track[],
  requestedSource: string | null,
  playbackMode: string,
  seamlessPlayback: boolean,
  crossfadePlayback: boolean,
  crossfadeDurationMs: number,
  startPosition: number,
): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    const playableTracks = tracks.filter((track) => canUseRustAudioBackend(track.path));
    const selectedTrack = requestedSource
      ? playableTracks.find((track) => track.path === requestedSource)
      : playableTracks[0];
    return Promise.resolve({
      tracks: playableTracks,
      sources: playableTracks.map((track) => track.path),
      currentSource: selectedTrack?.path ?? null,
      currentIndex: selectedTrack ? playableTracks.findIndex((track) => track.path === selectedTrack.path) : null,
      playbackMode,
    });
  }

  return invokeApi<RustQueueSnapshot>('player_start_queue', {
    tracks,
    requestedSource,
    playbackMode,
    seamlessPlayback,
    crossfadePlayback,
    crossfadeDurationMs,
    startPosition,
  });
}

export function restoreRustBackendQueue(
  tracks: Track[],
  currentSource: string | null,
  playbackMode: string,
  seamlessPlayback: boolean,
  crossfadePlayback: boolean,
  crossfadeDurationMs: number,
): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    const playableTracks = tracks.filter((track) => canUseRustAudioBackend(track.path));
    const selectedTrack = currentSource
      ? playableTracks.find((track) => track.path === currentSource)
      : playableTracks[0];
    return Promise.resolve({
      tracks: playableTracks,
      sources: playableTracks.map((track) => track.path),
      currentSource: selectedTrack?.path ?? null,
      currentIndex: selectedTrack ? playableTracks.findIndex((track) => track.path === selectedTrack.path) : null,
      playbackMode,
    });
  }

  return invokeApi<RustQueueSnapshot>('player_restore_queue', {
    tracks,
    currentSource,
    playbackMode,
    seamlessPlayback,
    crossfadePlayback,
    crossfadeDurationMs,
  });
}

export function setRustBackendPlaybackMode(playbackMode: string): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve(emptyQueueSnapshot(playbackMode));
  }

  return invokeApi<RustQueueSnapshot>('player_set_playback_mode', { playbackMode });
}

export function playRustBackendNext(): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve(emptyQueueSnapshot());
  }

  return invokeApi<RustQueueSnapshot>('player_next');
}

export function playRustBackendPrevious(): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve(emptyQueueSnapshot());
  }

  return invokeApi<RustQueueSnapshot>('player_previous');
}

export function changeRustBackendQueueTrackQuality(quality: string, startPosition: number): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve(emptyQueueSnapshot());
  }

  return invokeApi<RustQueueSnapshot>('player_change_queue_track_quality', { quality, startPosition });
}

export function insertRustBackendQueueNext(track: Track): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ ...emptyQueueSnapshot(), tracks: [track], sources: [track.path] });
  }

  return invokeApi<RustQueueSnapshot>('player_queue_insert_next', { track });
}

export function appendRustBackendQueue(track: Track): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve({ ...emptyQueueSnapshot(), tracks: [track], sources: [track.path] });
  }

  return invokeApi<RustQueueSnapshot>('player_queue_append', { track });
}

export function removeRustBackendQueueSource(source: string): Promise<RustQueueSnapshot> {
  if (!isTauriRuntime()) {
    return Promise.resolve(emptyQueueSnapshot());
  }

  return invokeApi<RustQueueSnapshot>('player_queue_remove', { source });
}

export function listRustBackendOutputDevices(): Promise<RustAudioOutputDevice[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invokeApi<RustAudioOutputDevice[]>('player_output_devices');
}

export function setRustBackendOutputDevice(deviceId: string | null): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invokeApi<void>('player_set_output_device', { deviceId });
}

export function listenRustBackendEnded(callback: () => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return Promise.resolve(() => {});
  }

  return listen('player://ended', callback);
}

export function listenRustBackendState(callback: (state: RustPlayerState) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return Promise.resolve(() => {});
  }

  return listen<RustPlayerState>('player://state', (event) => callback(event.payload));
}

export function listenRustBackendAdvanced(callback: (source: string) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return Promise.resolve(() => {});
  }

  return listen<string>('player://advanced', (event) => callback(event.payload));
}

export function listenRustBackendQueue(callback: (snapshot: RustQueueSnapshot) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return Promise.resolve(() => {});
  }

  return listen<RustQueueSnapshot>('player://queue', (event) => callback(event.payload));
}

export function listenRustBackendOutputDeviceFallback(callback: (event: RustOutputDeviceFallbackEvent) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return Promise.resolve(() => {});
  }

  return listen<RustOutputDeviceFallbackEvent>('player://output-device-fallback', (event) => callback(event.payload));
}
