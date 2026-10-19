import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseLocalPlaybackActionsOptions {
  player: ReturnType<typeof usePlayerStore>;
  rustPlaybackQueue: ReadonlyRefValue<Track[]>;
  visibleTracks: ReadonlyRefValue<Track[]>;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useLocalPlaybackActions({
  player,
  rustPlaybackQueue,
  visibleTracks,
  startRustPlaybackQueue,
}: UseLocalPlaybackActionsOptions) {
  async function playTrack(track: Track) {
    player.error = null;
    await startRustPlaybackQueue(visibleTracks.value, track);
  }

  async function playFavoriteTracks() {
    player.error = null;
    await startRustPlaybackQueue(visibleTracks.value, null);
  }

  async function playQueueTrack(track: Track) {
    player.error = null;
    await startRustPlaybackQueue(rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [track], track);
  }

  return {
    playFavoriteTracks,
    playQueueTrack,
    playTrack,
  };
}
