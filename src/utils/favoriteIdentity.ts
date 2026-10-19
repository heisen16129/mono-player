import type { Track } from '../types/music';
import { isRemoteTrack } from './playback';

export function favoriteIdentity(track: Track): string {
  if (isRemoteTrack(track)) {
    const provider = track.sourceProviderId || track.sourceName;
    if (provider && track.sourceId) return JSON.stringify(['source', provider, track.sourceId]);
    return JSON.stringify(['url', track.path]);
  }
  const path = track.path.replace(/\\/g, '/').replace(/^\/\/\?\//, '').replace(/\/+$/, '').toLowerCase();
  return JSON.stringify(['local', path]);
}
