import { invokeApi } from './api';
import { isTauriRuntime } from './music';
import type { PlaybackSession } from '../types/music';

export function readPlaybackSession(): Promise<PlaybackSession | null> {
  return isTauriRuntime() ? invokeApi<PlaybackSession | null>('player_read_session') : Promise.resolve(null);
}
