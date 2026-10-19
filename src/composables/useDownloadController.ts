import { useDownloadState } from './useDownloadState';
import { downloadRecordAction, enqueueDownloadOnlineTrack, openDownloadedTrackInFolder, type DownloadOnlineTrackRequest, type DownloadQueueEvent } from '../services/downloads';
import { isTauriRuntime } from '../services/music';
import { usePlayerStore } from '../stores/player';
import type { DownloadItem, Track, TrackLyrics } from '../types/music';
import { artistLabel } from '../utils/artist';
import { getErrorMessage } from '../utils/error';

interface UseDownloadControllerOptions {
  closeContextMenus: () => void;
  showToast: (message: string, variant?: 'success' | 'error') => void;
}

export interface DownloadTrackOptions {
  preferredQuality?: string | null;
  lyricFormat?: string | null;
  trackLyrics?: TrackLyrics | null;
}

export function useDownloadController({ closeContextMenus, showToast }: UseDownloadControllerOptions) {
  const player = usePlayerStore();
  const {
    downloadItems,
    downloadedTrackKeys,
    getDownloadTrackKey,
    handleDownloadQueueEvent: applyDownloadQueueEvent,
    isTrackDownloaded,
    isTrackDownloadPending,
    loadDownloadItems,
    pendingDownloadTrackKeys,
  } = useDownloadState();

  async function handleDownloadQueueEvent(event: DownloadQueueEvent) {
    const result = await applyDownloadQueueEvent(event);
    if (result?.status === 'downloaded') {
      showToast(`下载完成：${result.item.title}`, 'success');
    }
    if (result?.status === 'failed') {
      showToast(`${result.item.title} 下载失败：${result.error}`);
    }
  }

  async function applyAction(item: DownloadItem, action: 'pause' | 'resume' | 'retry' | 'clear' | 'delete', label: string) {
    try {
      await downloadRecordAction(item.id, action);
      await loadDownloadItems();
      showToast(`${label}：${item.title}`, 'success');
    } catch (error) {
      showToast(`${label}失败：${getErrorMessage(error)}`);
    }
  }

  const deleteDownloadedItem = (item: DownloadItem) => applyAction(item, 'delete', '已删除本地下载');
  const clearDownloadedItemRecord = (item: DownloadItem) => applyAction(item, 'clear', '已清除下载记录');

  async function openDownloadedItemFolder(item: DownloadItem) {
    if (!isTauriRuntime()) return;

    try {
      await openDownloadedTrackInFolder({
        filePath: item.filePath,
        lyricsPath: item.lyricsPath,
        downloadDir: player.settings.downloadDir,
        title: item.title,
        artist: artistLabel(item.artist, ''),
      });
    } catch (error) {
      player.error = getErrorMessage(error);
      showToast(player.error);
    }
  }

  const pauseDownloadItem = (item: DownloadItem) => applyAction(item, 'pause', '已暂停');
  const retryDownloadItem = (item: DownloadItem) => applyAction(item, 'retry', '重试下载');
  const resumeDownloadItem = (item: DownloadItem) => applyAction(item, 'resume', '继续下载');

  async function downloadTrack(track: Track, options: DownloadTrackOptions = {}) {
    closeContextMenus();
    const itemId = getDownloadTrackKey(track);
    if (downloadedTrackKeys.value.includes(itemId) || pendingDownloadTrackKeys.value.includes(itemId)) {
      showToast(`已在下载列表中：${track.title}`);
      return;
    }
    try {
      const request: DownloadOnlineTrackRequest = {
        downloadDir: player.settings.downloadDir,
        preferredQuality: options.preferredQuality ?? null,
        qualityFallback: player.settings.qualityFallback,
        lyricFormat: options.lyricFormat ?? null,
        trackLyrics: options.trackLyrics ?? null,
        track,
      };
      await enqueueDownloadOnlineTrack(request);
      await loadDownloadItems();
      showToast(`已添加到下载队列：${track.title}`, 'success');
    } catch (error) {
      showToast(`${track.title} 下载失败：${getErrorMessage(error)}`);
    }
  }

  return {
    clearDownloadedItemRecord,
    deleteDownloadedItem,
    downloadItems,
    downloadedTrackKeys,
    downloadTrack,
    handleDownloadQueueEvent,
    isTrackDownloaded,
    isTrackDownloadPending,
    loadDownloadItems,
    openDownloadedItemFolder,
    pauseDownloadItem,
    pendingDownloadTrackKeys,
    resumeDownloadItem,
    retryDownloadItem,
  };
}
