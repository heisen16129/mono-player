import type { DownloadItem, Track } from '../types/music';
import {
  isDownloadedOnlineLocalPlaybackTrack as isDownloadedOnlineLocalPlaybackTrackFromItems,
  withDownloadedPlaybackSource as withDownloadedPlaybackSourceFromItems,
} from '../utils/downloadedTrack';
import { isSameOnlineTrackIdentity } from '../utils/onlineTrack';
import { dedupePlaybackQueue } from '../utils/playback';
import { queueSourceKey } from '../utils/queueSource';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseDownloadedOnlinePlaybackFallbackOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  downloadItems: ReadonlyRefValue<DownloadItem[]>;
  rustPlaybackQueue: ReadonlyRefValue<Track[]>;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useDownloadedOnlinePlaybackFallback({
  activeTrack,
  downloadItems,
  rustPlaybackQueue,
  startRustPlaybackQueue,
}: UseDownloadedOnlinePlaybackFallbackOptions) {
  function withDownloadedPlaybackSource(track: Track) {
    return withDownloadedPlaybackSourceFromItems(track, downloadItems.value);
  }

  function isDownloadedOnlineLocalPlaybackTrack(track: Track | null) {
    return isDownloadedOnlineLocalPlaybackTrackFromItems(track, downloadItems.value);
  }

  async function retryActiveDownloadedOnlineTrackFromPlugin(startPosition = 0) {
    const active = activeTrack.value;
    if (!active || !isDownloadedOnlineLocalPlaybackTrack(active)) return false;

    const fallbackTrack: Track = {
      ...active,
      path: queueSourceKey(active),
    };
    const fallbackQueue = dedupePlaybackQueue((rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [active]).map((track) => (
      isSameOnlineTrackIdentity(track, active) ? fallbackTrack : track
    )));

    return startRustPlaybackQueue(fallbackQueue, fallbackTrack, startPosition);
  }

  return {
    isDownloadedOnlineLocalPlaybackTrack,
    retryActiveDownloadedOnlineTrackFromPlugin,
    withDownloadedPlaybackSource,
  };
}
