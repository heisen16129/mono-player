import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { CoverImage, LyricLine, Track, TrackLyrics } from '../types/music';
import { artistNames } from '../utils/artist';
import { invokeApi } from './api';

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
  artist: string[];
  album: string | null;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
}

export interface UpdateTrackCoverRequest {
  trackId: number;
  path: string;
  coverPath: string;
  embedMetadata?: boolean;
}

export interface UpdateTrackCoverResult {
  artwork: string | null;
}

export interface CropCoverImageRequest {
  imageDataUrl?: string;
  imagePath: string;
  x: number;
  y: number;
  size: number;
}

export interface CropCoverImageResult {
  path: string;
}

export interface RefreshTrackDurationRequest {
  id: number;
  path: string;
}

export interface RefreshTrackDurationResult {
  id: number;
  duration: number;
}

export interface ReadTrackAudioInfoRequest {
  path: string;
}

export interface TrackAudioInfo {
  durationSeconds: number | null;
  containerFormat: string | null;
  codec: string | null;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  bitDepth: number | null;
  lossless: boolean | null;
  channels: number | null;
  fileSizeBytes: number | null;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function listTracks(): Promise<Track[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invokeApi<Track[]>('list_tracks').then(normalizeTracks);
}

export function listLatestAddedTracks(): Promise<Track[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invokeApi<Track[]>('list_latest_added_tracks').then(normalizeTracks);
}

export function removeMusicDir(path: string): Promise<Track[]> {
  if (!isTauriRuntime()) {
    return Promise.resolve([]);
  }

  return invokeApi<Track[]>('remove_music_dir', { path }).then(normalizeTracks);
}

export function updateTrackMetadata(request: UpdateTrackMetadataRequest): Promise<UpdateTrackMetadataResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中更改歌曲元数据。'));
  }

  return invokeApi<UpdateTrackMetadataResult>('update_track_metadata', { request });
}

export function updateTrackCover(request: UpdateTrackCoverRequest): Promise<UpdateTrackCoverResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中更换歌曲封面。'));
  }

  return invokeApi<UpdateTrackCoverResult>('update_track_cover', { request });
}

export function cropCoverImage(request: CropCoverImageRequest): Promise<CropCoverImageResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中编辑歌曲封面。'));
  }

  return invokeApi<CropCoverImageResult>('crop_cover_image', { request });
}

export function readTrackCoverOriginal(path: string): Promise<string | null> {
  if (!isTauriRuntime() || !path) {
    return Promise.resolve(null);
  }

  return invokeApi<string | null>('read_track_cover_original', { path });
}

export function refreshTrackDuration(request: RefreshTrackDurationRequest): Promise<RefreshTrackDurationResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中重新读取歌曲时长。'));
  }

  return invokeApi<RefreshTrackDurationResult>('refresh_track_duration', { request });
}

export function readTrackAudioInfo(request: ReadTrackAudioInfoRequest): Promise<TrackAudioInfo> {
  if (!isTauriRuntime()) {
    return Promise.resolve({
      durationSeconds: null,
      containerFormat: null,
      codec: null,
      bitrateKbps: null,
      sampleRateHz: null,
      bitDepth: null,
      lossless: null,
      channels: null,
      fileSizeBytes: null,
    });
  }

  return invokeApi<TrackAudioInfo>('read_track_audio_info', { request });
}

export async function scanMusicDir(path: string): Promise<ScanMusicDirResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中扫描本地音乐目录。'));
  }

  const result = await invokeApi<RawScanMusicDirResult>('scan_music_dir', { path });
  if (Array.isArray(result)) {
    return { tracks: normalizeTracks(result), addedTracks: [], addedTrackIds: [] };
  }

  return {
    tracks: normalizeTracks(Array.isArray(result.tracks) ? result.tracks : []),
    addedTracks: normalizeTracks(Array.isArray(result.addedTracks) ? result.addedTracks : []),
    addedTrackIds: Array.isArray(result.addedTrackIds) ? result.addedTrackIds : [],
  };
}

function normalizeTrack(track: Track): Track {
  return {
    ...track,
    artist: artistNames(track.artist),
  };
}

function normalizeTracks(tracks: Track[]) {
  return tracks.map(normalizeTrack);
}

export function cancelScanMusicDir(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return Promise.resolve(false);
  }

  return invokeApi<boolean>('cancel_scan_music_dir');
}

export interface LyricsSourceInput {
  content?: string | null;
  format?: string | null;
}

export function resolveLyricsSource(track?: LyricsSourceInput | null): Promise<LyricLine[]> {
  if (!isTauriRuntime() || !track) {
    return Promise.resolve([]);
  }

  return invokeApi<LyricLine[]>('resolve_lyrics_source', {
    lyrics: {
      content: track.content ?? null,
      format: track.format ?? null,
    },
  });
}

export function resolveLocalTrackLyrics(track?: Track | null): Promise<TrackLyrics | null> {
  if (!isTauriRuntime() || !track?.path) {
    return Promise.resolve(null);
  }

  return invokeApi<TrackLyrics | null>('resolve_local_track_lyrics', { track });
}

export function readArtworkFile(artwork: string): Promise<CoverImage | null> {
  if (!isTauriRuntime() || !artwork) {
    return Promise.resolve(null);
  }

  return invokeApi<CoverImage | null>('read_artwork_file', { artwork });
}

export function openTrackInFolder(path: string): Promise<void> {
  if (!isTauriRuntime() || !path) {
    return Promise.resolve();
  }

  return invokeApi<void>('open_track_in_folder', { path });
}

export function hideMainWindowToTray(): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invokeApi<void>('hide_main_window_to_tray');
}

export function exitApp(): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invoke('exit_app');
}

export function toAudioSource(path: string): string {
  return convertFileSrc(path);
}
