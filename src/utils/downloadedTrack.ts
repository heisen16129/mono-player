import type { DownloadItem, Track } from '../types/music';
import { normalizePath } from './path';
import { isRemoteTrack } from './playback';
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

export function findDownloadedItemForQueueTrack(track: Track, downloadItems: DownloadItem[]) {
  const sourceId = track.sourceId?.trim();
  if (!sourceId) return null;
  return downloadItems.find((item) => (
    item.sourceId === sourceId
    && (!track.sourceName || item.sourceName === track.sourceName)
    && item.status === 'downloaded'
    && Boolean(item.filePath)
  )) ?? null;
}

export function withDownloadedPlaybackSource(track: Track, downloadItems: DownloadItem[]) {
  const downloadedItem = findDownloadedItemForQueueTrack(track, downloadItems);
  if (!downloadedItem?.filePath) return track;
  return {
    ...track,
    path: downloadedItem.filePath,
    artwork: track.artwork ?? downloadedItem.artwork ?? null,
  };
}

export function isDownloadedOnlineLocalPlaybackTrack(track: Track | null, downloadItems: DownloadItem[]) {
  if (!track?.sourceProviderId || !track.sourceId || isRemoteTrack(track)) return false;
  const downloadedItem = findDownloadedItemForQueueTrack(track, downloadItems);
  return Boolean(downloadedItem?.filePath && normalizePath(downloadedItem.filePath) === normalizePath(track.path));
}

export function downloadTrackIdentityKey(track: Track) {
  const path = normalizePath(track.path);
  return path ? `path:${path}` : `id:${track.id}`;
}
