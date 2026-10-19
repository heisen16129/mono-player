import { ref } from 'vue';
import { downloadRecordsSnapshot } from '../services/downloads';
import type { DownloadQueueEvent } from '../services/downloads';
import type { DownloadItem, Track } from '../types/music';

// Shared backend-classified snapshots used by the download page and playback badges.
export const downloadRecordGroups = ref<{ downloaded: DownloadItem[]; downloading: DownloadItem[] }>({ downloaded: [], downloading: [] });

type DownloadQueueEventResult =
  | { status: 'downloaded'; item: DownloadItem }
  | { status: 'failed'; item: DownloadItem; error: string }
  | null;

export function useDownloadState() {
  const downloadItems = ref<DownloadItem[]>([]);
  let loadQueue: Promise<void> = Promise.resolve();

  const downloadedTrackKeys = ref<string[]>([]);
  const pendingDownloadTrackKeys = ref<string[]>([]);

  function getDownloadTrackKey(track: Track) {
    const sourceName = track.sourceName ?? '本地';
    const sourceId = track.sourceId ?? String(track.id);
    return `${sourceName}:${sourceId}`;
  }

  function loadDownloadItems() {
    const next = loadQueue.catch(() => {}).then(async () => {
      const snapshot = await downloadRecordsSnapshot();
      downloadRecordGroups.value = { downloaded: snapshot.downloaded, downloading: snapshot.downloading };
      downloadItems.value = [...snapshot.downloaded, ...snapshot.downloading];
      downloadedTrackKeys.value = snapshot.downloadedKeys;
      pendingDownloadTrackKeys.value = snapshot.pendingKeys;
    });
    loadQueue = next;
    return next;
  }

  async function handleDownloadQueueEvent(event: DownloadQueueEvent): Promise<DownloadQueueEventResult> {
    await loadDownloadItems();
    const item = downloadItems.value.find((entry) => entry.id === event.taskId);
    if (!item || item.status !== event.status) return null;
    if (event.status === 'downloaded') return { status: 'downloaded', item };
    if (event.status === 'failed') return { status: 'failed', item, error: item.error ?? '下载失败' };
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
  };
}
