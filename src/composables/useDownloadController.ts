import { useDownloadState } from './useDownloadState';
import { deleteDownloadedTrackFile, enqueueDownloadOnlineTrack, openDownloadedTrackInFolder, type DownloadOnlineTrackRequest, type DownloadQueueEvent } from '../services/downloads';
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
    persistDownloadItems,
    updateDownloadItem,
  } = useDownloadState();

  function handleDownloadQueueEvent(event: DownloadQueueEvent) {
    const result = applyDownloadQueueEvent(event);
    if (result?.status === 'downloaded') {
      showToast(`下载完成：${result.item.title}`, 'success');
    }
    if (result?.status === 'failed') {
      showToast(`${result.item.title} 下载失败：${result.error}`);
    }
  }

  async function deleteDownloadedItem(item: DownloadItem) {
    if (item.filePath) {
      try {
        await deleteDownloadedTrackFile({
          filePath: item.filePath,
          lyricsPath: item.lyricsPath,
          downloadDir: player.settings.downloadDir,
          title: item.title,
          artist: artistLabel(item.artist, ''),
        });
      } catch (error) {
        showToast(`删除失败：${getErrorMessage(error)}`);
        return;
      }
    }

    downloadItems.value = downloadItems.value.filter((entry) => entry.id !== item.id);
    await persistDownloadItems();
    showToast(`已删除本地下载：${item.title}`, 'success');
  }

  async function clearDownloadedItemRecord(item: DownloadItem) {
    downloadItems.value = downloadItems.value.filter((entry) => entry.id !== item.id);
    await persistDownloadItems();
    showToast(`已清除下载记录：${item.title}`, 'success');
  }

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

  function pauseDownloadItem(item: DownloadItem) {
    if (item.status !== 'downloading') return;
    updateDownloadItem(item.id, { status: 'paused', error: null });
    showToast(`已暂停：${item.title}`, 'success');
  }

  async function enqueueDownloadItemRequest(item: DownloadItem, actionLabel: string) {
    const request = item.downloadRequest;
    if (!request?.track) {
      showToast(`${item.title} 缺少下载信息，请重新从搜索结果下载`);
      return;
    }

    try {
      updateDownloadItem(item.id, { status: 'downloading', progress: Math.max(1, item.progress || 0), error: null });
      await enqueueDownloadOnlineTrack({ ...request, taskId: item.id } as DownloadOnlineTrackRequest);
      showToast(`${actionLabel}：${item.title}`, 'success');
    } catch (error) {
      const message = getErrorMessage(error, '下载失败');
      updateDownloadItem(item.id, { status: 'failed', error: message });
      showToast(`${item.title} ${actionLabel}失败：${message}`);
    }
  }

  async function retryDownloadItem(item: DownloadItem) {
    await enqueueDownloadItemRequest(item, '重试下载');
  }

  async function resumeDownloadItem(item: DownloadItem) {
    await enqueueDownloadItemRequest(item, '继续下载');
  }

  function downloadTrack(track: Track, options: DownloadTrackOptions = {}) {
    const sourceName = track.sourceName ?? '本地';
    const sourceId = track.sourceId ?? String(track.id);
    const itemId = getDownloadTrackKey(track);
    if (downloadedTrackKeys.value.includes(itemId)) {
      closeContextMenus();
      showToast(`已下载：${track.title}`, 'success');
      return;
    }

    if (pendingDownloadTrackKeys.value.includes(itemId)) {
      closeContextMenus();
      showToast(`正在下载：${track.title}`, 'success');
      return;
    }

    const item: DownloadItem = {
      id: itemId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      sourceName,
      sourceId,
      artwork: track.artwork ?? null,
      status: 'downloading',
      progress: 0,
      createdAt: Date.now(),
    };

    downloadItems.value = [item, ...downloadItems.value.filter((entry) => entry.id !== item.id)];
    void persistDownloadItems();
    closeContextMenus();

    if (!player.settings.downloadDir) {
      const message = '请先在设置中选择下载位置';
      updateDownloadItem(item.id, { status: 'failed', error: message });
      showToast(message);
      return;
    }

    showToast(`已添加到下载队列：${track.title}`, 'success');
    void prepareAndEnqueueDownload(track, item, options);
  }

  async function prepareAndEnqueueDownload(track: Track, item: DownloadItem, options: DownloadTrackOptions) {
    try {
      const downloadRequest: DownloadOnlineTrackRequest = {
        taskId: item.id,
        downloadDir: player.settings.downloadDir,
        preferredQuality: options.preferredQuality ?? null,
        qualityFallback: player.settings.qualityFallback,
        lyricFormat: options.lyricFormat ?? null,
        trackLyrics: options.trackLyrics ?? null,
        track,
      };
      updateDownloadItem(item.id, { downloadRequest });
      await enqueueDownloadOnlineTrack(downloadRequest);
      updateDownloadItem(item.id, { status: 'downloading', progress: 1, error: null, downloadRequest });
    } catch (error) {
      const message = getErrorMessage(error, '下载失败');
      updateDownloadItem(item.id, { status: 'failed', error: message });
      showToast(`${track.title} 下载失败：${message}`);
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
