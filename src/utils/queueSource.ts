import type { Track } from '../types/music';
import { normalizePath } from './path';

export function queueSourceKey(track: Track) {
  const providerId = track.sourceProviderId?.trim();
  const sourceId = track.sourceId?.trim();
  if (providerId && sourceId) return `plugin://${providerId}/${sourceId}`;
  return track.path;
}

export function normalizedQueueSourceKey(track: Track) {
  return normalizePath(queueSourceKey(track));
}

export function isSameQueueSource(left: Track, right: Track) {
  return normalizedQueueSourceKey(left) === normalizedQueueSourceKey(right);
}
