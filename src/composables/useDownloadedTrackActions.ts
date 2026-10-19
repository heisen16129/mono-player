import type { Ref } from 'vue';
import type { DownloadTrackOptions } from './useDownloadController';
import type { DownloadItem, Track } from '../types/music';
import { createDownloadTrack } from '../utils/downloadedTrack';
import { isRemoteTrack } from '../utils/playback';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseDownloadedTrackActionsOptions {
  downloadItems: ReadonlyRefValue<DownloadItem[]>;
  onlineActiveTrack: ReadonlyRefValue<Track | null>;
  rustPlaybackQueue: Ref<Track[]>;
  downloadTrack: (track: Track, options?: DownloadTrackOptions) => void;
  getActiveDownloadOptions: () => DownloadTrackOptions;
  openAddToPlaylistDialog: (track: Track) => void;
  queueTrackNext: (track: Track) => void;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useDownloadedTrackActions({
  downloadItems,
  onlineActiveTrack,
  rustPlaybackQueue,
  downloadTrack,
  getActiveDownloadOptions,
  openAddToPlaylistDialog,
  queueTrackNext,
  startRustPlaybackQueue,
}: UseDownloadedTrackActionsOptions) {
  function queueDownloadedTrackNext(item: DownloadItem) {
    queueTrackNext(createDownloadTrack(item));
  }

  async function playDownloadedTrack(track: Track) {
    if (!track.path) return;
    const selectedItem = downloadItems.value.find((item) => createDownloadTrack(item).id === track.id);
    if (selectedItem?.status !== 'downloaded' || !selectedItem.filePath) return;
    const queue = downloadItems.value
      .filter((item) => item.status === 'downloaded' && item.filePath)
      .map(createDownloadTrack)
      .filter((item) => Boolean(item.path));
    rustPlaybackQueue.value = queue.length > 0 ? queue : [track];
    await startRustPlaybackQueue(rustPlaybackQueue.value, track);
  }

  function addDownloadedTrackToPlaylist(item: DownloadItem) {
    openAddToPlaylistDialog(createDownloadTrack(item));
  }

  function downloadActiveOnlineTrack() {
    if (!onlineActiveTrack.value || !isRemoteTrack(onlineActiveTrack.value)) return;
    downloadTrack(onlineActiveTrack.value, getActiveDownloadOptions());
  }

  return {
    addDownloadedTrackToPlaylist,
    downloadActiveOnlineTrack,
    playDownloadedTrack,
    queueDownloadedTrackNext,
  };
}
