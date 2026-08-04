import type { RustQueueSnapshot } from '../services/playerBackend';
import type { Track } from '../types/music';
import { normalizePath } from './path';
import { normalizedQueueSourceKey } from './queueSource';

function findTrackBySource(tracks: Track[], source: string) {
  const normalizedSource = source ? normalizePath(source) : '';
  if (!normalizedSource) return null;
  return tracks.find((item) => (
    normalizePath(item.path) === normalizedSource
    || normalizedQueueSourceKey(item) === normalizedSource
  )) ?? null;
}

export function resolveRustQueueSnapshotTrack(snapshot: RustQueueSnapshot, tracks: Track[]) {
  const currentSource = snapshot.currentSource ?? '';
  const currentTrack = findTrackBySource(tracks, currentSource);
  if (currentTrack) return currentTrack;

  if (typeof snapshot.currentIndex !== 'number') return null;

  const indexedSource = snapshot.sources[snapshot.currentIndex] ?? '';
  return findTrackBySource(tracks, indexedSource) ?? tracks[snapshot.currentIndex] ?? null;
}
