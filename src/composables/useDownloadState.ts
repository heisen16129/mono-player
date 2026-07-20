import { computed, ref } from 'vue';
import { readPersistentValue, writePersistentValue } from '../services/persistentStore';
import type { DownloadQueueEvent } from '../services/downloads';
import type { DownloadItem, Track } from '../types/music';

const DOWNLOAD_ITEMS_KEY = 'downloads.items';

type DownloadQueueEventResult =
  | { status: 'downloaded'; item: DownloadItem }
  | { status: 'failed'; item: DownloadItem; error: string }
  | null;

export function useDownloadState() {
  const downloadItems = ref<DownloadItem[]>([]);

  const downloadedTrackKeys = computed(() => (
    downloadItems.value
      .filter((item) => item.status === 'downloaded')
      .map((item) => item.id)
  ));

  const pendingDownloadTrackKeys = computed(() => (
    downloadItems.value
      .filter((item) => item.status === 'downloading' || item.status === 'paused')
      .map((item) => item.id)
  ));

  function getDownloadTrackKey(track: Track) {
    const sourceName = track.sourceName ?? '本地';
    const sourceId = track.sourceId ?? String(track.id);
    return `${sourceName}:${sourceId}`;
  }

  async function persistDownloadItems() {
    await writePersistentValue(DOWNLOAD_ITEMS_KEY, downloadItems.value);
  }

  async function loadDownloadItems() {
    const storedItems = await readPersistentValue<DownloadItem[]>(DOWNLOAD_ITEMS_KEY);
    downloadItems.value = (storedItems ?? []).map((item) => (
      item.status === 'downloading'
        ? { ...item, status: 'failed', progress: 0, error: item.error ?? '下载已中断' }
        : item
    ));
    await persistDownloadItems();
  }

  function updateDownloadItem(id: string, patch: Partial<DownloadItem>) {
    downloadItems.value = downloadItems.value.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    ));
    void persistDownloadItems();
  }

  function handleDownloadQueueEvent(event: DownloadQueueEvent): DownloadQueueEventResult {
    const currentItem = downloadItems.value.find((entry) => entry.id === event.taskId);
    if (event.status === 'downloaded') {
      updateDownloadItem(event.taskId, {
        status: 'downloaded',
        progress: 100,
        filePath: event.filePath,
        lyricsPath: event.lyricsPath,
        error: null,
      });
      const item = downloadItems.value.find((entry) => entry.id === event.taskId);
      return item ? { status: 'downloaded', item } : null;
    }

    if (event.status === 'failed') {
      if (currentItem?.status === 'paused') return null;
      const error = event.error ?? '下载失败';
      updateDownloadItem(event.taskId, {
        status: 'failed',
        progress: event.progress,
        error,
      });
      const item = downloadItems.value.find((entry) => entry.id === event.taskId);
      return item ? { status: 'failed', item, error } : null;
    }

    if (currentItem?.status === 'paused') return null;
    updateDownloadItem(event.taskId, {
      status: 'downloading',
      progress: event.progress,
      error: null,
    });
    return null;
  }

  function isTrackDownloaded(track: Track) {
    return downloadedTrackKeys.value.includes(getDownloadTrackKey(track));
  }

  function isTrackDownloadPending(track: Track) {
    return pendingDownloadTrackKeys.value.includes(getDownloadTrackKey(track));
  }

  return {
    downloadItems,
    downloadedTrackKeys,
    getDownloadTrackKey,
    handleDownloadQueueEvent,
    isTrackDownloaded,
    isTrackDownloadPending,
    loadDownloadItems,
    pendingDownloadTrackKeys,
    persistDownloadItems,
    updateDownloadItem,
  };
}
