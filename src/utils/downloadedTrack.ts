import type { DownloadItem, Track } from '../types/music';
import { normalizePath } from './path';
import { positiveStableStringHash } from './trackKey';

export function createDownloadTrack(item: DownloadItem): Track {
  return {
    id: -positiveStableStringHash(`download:${item.id}`),
    path: item.filePath ?? '',
    title: item.title,
    artist: item.artist,
    album: item.album,
    duration: item.duration,
    artwork: item.artwork ?? null,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
  };
}

export function downloadTrackIdentityKey(track: Track) {
  const path = normalizePath(track.path);
  return path ? `path:${path}` : `id:${track.id}`;
}
