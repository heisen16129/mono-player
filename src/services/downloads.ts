import { invokeApi } from './api';
import { isTauriRuntime } from './music';
import { listInstalledPlugins } from './plugins';
import type { Track } from '../types/music';
import type { PluginManifest } from '../types/plugin';

export interface DownloadOnlineTrackRequest {
  taskId?: string;
  downloadDir: string;
  track: Track;
  qualityFallback?: string | null;
  plugins?: PluginManifest[];
}

export interface DownloadLyricsFileRequest {
  downloadDir: string;
  title: string;
  artist: string | null;
  lyrics: string;
  format: string;
}

export interface DownloadLyricsFileResult {
  path: string;
}

export interface DownloadCoverFileRequest {
  downloadDir: string;
  trackPath?: string | null;
  title: string;
  artist: string | null;
  artworkUrl?: string | null;
  mimeType?: string | null;
  data?: number[] | null;
}

export interface DownloadCoverFileResult {
  path: string | null;
  embeddedInTrack: boolean;
}

export interface DeleteDownloadedTrackFileRequest {
  filePath?: string | null;
  lyricsPath?: string | null;
  downloadDir?: string | null;
  title?: string | null;
  artist?: string | null;
}

export interface EnqueueDownloadResult {
  taskId: string;
}

export interface DownloadQueueEvent {
  taskId: string;
  status: 'downloading' | 'downloaded' | 'failed';
  progress: number;
  filePath: string | null;
  lyricsPath: string | null;
  error: string | null;
}

async function withInstalledPlugins(request: DownloadOnlineTrackRequest): Promise<DownloadOnlineTrackRequest> {
  return {
    ...request,
    plugins: request.plugins ?? await listInstalledPlugins(),
  };
}

export async function enqueueDownloadOnlineTrack(request: DownloadOnlineTrackRequest): Promise<EnqueueDownloadResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在 Tauri 桌面窗口中下载音乐。'));
  }

  return invokeApi<EnqueueDownloadResult>('enqueue_download_online_track', { request: await withInstalledPlugins(request) });
}

export function downloadLyricsFile(request: DownloadLyricsFileRequest): Promise<DownloadLyricsFileResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在桌面窗口中下载歌词。'));
  }

  return invokeApi<DownloadLyricsFileResult>('download_lyrics_file', { request });
}

export function downloadCoverFile(request: DownloadCoverFileRequest): Promise<DownloadCoverFileResult> {
  if (!isTauriRuntime()) {
    return Promise.reject(new Error('请在桌面窗口中下载封面。'));
  }

  return invokeApi<DownloadCoverFileResult>('download_cover_file', { request });
}

export function deleteDownloadedTrackFile(request: DeleteDownloadedTrackFileRequest): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invokeApi<void>('delete_downloaded_track_file', { request });
}

export function openDownloadedTrackInFolder(request: DeleteDownloadedTrackFileRequest): Promise<void> {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }

  return invokeApi<void>('open_downloaded_track_in_folder', { request });
}
