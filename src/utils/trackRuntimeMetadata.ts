import type { Track } from '../types/music';
import { isSameOnlineTrackIdentity } from './onlineTrack';
import { normalizePath } from './path';
import { isSameQueueSource, queueSourceKey } from './queueSource';

export function shouldPreserveOnlineDisplayPath(existing: Track, incoming: Track) {
  return isSameOnlineTrackIdentity(existing, incoming) && existing.path.startsWith('plugin://');
}

export function mergeTrackRuntimeMetadata(track: Track, candidates: Track[]) {
  const existing = candidates.find((item) => (
    item.id === track.id
    || normalizePath(item.path) === normalizePath(track.path)
    || isSameOnlineTrackIdentity(item, track)
  ));
  if (!existing) return track;
  return {
    ...track,
    path: shouldPreserveOnlineDisplayPath(existing, track)
      ? existing.path
      : track.path,
    lyrics: track.lyrics ?? existing.lyrics ?? null,
    associatedLyrics: track.associatedLyrics ?? existing.associatedLyrics ?? null,
    associatedArtwork: track.associatedArtwork ?? existing.associatedArtwork ?? null,
    artwork: track.artwork ?? existing.artwork ?? null,
  };
}

export function isSameTrackForMetadata(track: Track | null | undefined, target: Track) {
  if (!track) return false;
  const trackSourceKey = queueSourceKey(track).trim();
  const targetSourceKey = queueSourceKey(target).trim();
  if (trackSourceKey && targetSourceKey) {
    return isSameQueueSource(track, target);
  }
  return track.id === target.id;
}
