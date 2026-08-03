import type { Ref } from 'vue';
import { restoreRustBackendQueue, startRustBackendQueue, type RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { isPlaybackRequestReplacedError } from '../utils/playback';

interface UseRustPlaybackLifecycleOptions {
  playbackTime: Ref<number>;
  restorePlaybackTime: Ref<number>;
  rustPlaybackQueue: Ref<Track[]>;
  player: ReturnType<typeof usePlayerStore>;
  crossfadeDurationMs: number;
  dedupePlaybackQueue: (tracks: Track[]) => Track[];
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot, markPreparing?: boolean) => void;
}

export function useRustPlaybackLifecycle({
  playbackTime,
  restorePlaybackTime,
  rustPlaybackQueue,
  player,
  crossfadeDurationMs,
  dedupePlaybackQueue,
  handleRustQueueSnapshot,
}: UseRustPlaybackLifecycleOptions) {
  let isRestoringPlaybackQueue = false;

  function getIsRestoringPlaybackQueue() {
    return isRestoringPlaybackQueue;
  }

  async function startRustPlaybackQueue(tracks: Track[], requestedTrack: Track | null, startPosition = 0) {
    playbackTime.value = startPosition;
    const playbackTracks = dedupePlaybackQueue(tracks);
    try {
      const snapshot = await startRustBackendQueue(
        playbackTracks,
        requestedTrack?.path ?? null,
        player.playbackMode,
        player.settings.seamlessPlayback,
        player.settings.crossfadePlayback,
        crossfadeDurationMs,
        startPosition,
      );
      handleRustQueueSnapshot(snapshot);
      return true;
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return false;
      throw error;
    }
  }

  async function restoreRustPlaybackQueue(track: Track, currentTime: number) {
    const playbackTracks = dedupePlaybackQueue(player.queue.filter((item) => item.path));
    if (playbackTracks.length === 0) return;

    isRestoringPlaybackQueue = true;
    try {
      const snapshot = await restoreRustBackendQueue(
        playbackTracks,
        track.path || null,
        player.playbackMode,
        player.settings.seamlessPlayback,
        player.settings.crossfadePlayback,
        crossfadeDurationMs,
      );
      handleRustQueueSnapshot(snapshot, false);
      playbackTime.value = currentTime;
      restorePlaybackTime.value = currentTime;
    } catch {
      rustPlaybackQueue.value = playbackTracks;
    } finally {
      window.setTimeout(() => {
        isRestoringPlaybackQueue = false;
      }, 0);
    }
  }

  return {
    getIsRestoringPlaybackQueue,
    restoreRustPlaybackQueue,
    startRustPlaybackQueue,
  };
}
