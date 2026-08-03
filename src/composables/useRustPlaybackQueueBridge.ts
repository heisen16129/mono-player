import type { Track } from '../types/music';
import type { RustQueueSnapshot } from '../services/playerBackend';

interface UseRustPlaybackQueueBridgeOptions {
  handleSnapshot: (snapshot: RustQueueSnapshot, markPreparing?: boolean) => void;
  restoreQueue: (track: Track, currentTime: number) => Promise<void>;
  startQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useRustPlaybackQueueBridge({ handleSnapshot, restoreQueue, startQueue }: UseRustPlaybackQueueBridgeOptions) {
  async function startRustPlaybackQueue(tracks: Track[], requestedTrack: Track | null, startPosition = 0) {
    return startQueue(tracks, requestedTrack, startPosition);
  }

  async function restoreRustPlaybackQueue(track: Track, currentTime: number) {
    await restoreQueue(track, currentTime);
  }

  function handleRustQueueSnapshot(snapshot: RustQueueSnapshot, markPreparing = true) {
    handleSnapshot(snapshot, markPreparing);
  }

  return {
    handleRustQueueSnapshot,
    restoreRustPlaybackQueue,
    startRustPlaybackQueue,
  };
}
