import type { RustQueueSnapshot } from '../services/playerBackend';
import type { Track } from '../types/music';
import { normalizePath } from './path';
import { normalizedQueueSourceKey } from './queueSource';

export function resolveRustQueueSnapshotTrack(snapshot: RustQueueSnapshot, tracks: Track[]) {
  const currentSource = snapshot.currentSource ?? '';
  const normalizedSource = currentSource ? normalizePath(currentSource) : '';
  return tracks.find((item) => (
    normalizePath(item.path) === normalizedSource
    || normalizedQueueSourceKey(item) === normalizedSource
  )) ?? (
    typeof snapshot.currentIndex === 'number'
      ? tracks[snapshot.currentIndex] ?? null
      : null
  );
}
