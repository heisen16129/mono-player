import type { Ref } from 'vue';
import {
  listenRustBackendAdvanced,
  restoreRustBackendQueue,
  startRustBackendQueue,
  type RustPlaybackAdvancedEvent,
  type RustQueueSnapshot,
} from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { isPlaybackRequestReplacedError } from '../utils/playback';

interface UseRustPlaybackLifecycleOptions {
  playbackTime: Ref<number>;
  rustPlaybackQueue: Ref<Track[]>;
  player: ReturnType<typeof usePlayerStore>;
  crossfadeDurationMs: number;
  handleRustPlaybackAdvanced: (event: RustPlaybackAdvancedEvent) => void;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
}

export function useRustPlaybackLifecycle({
  playbackTime,
  rustPlaybackQueue,
  player,
  crossfadeDurationMs,
  handleRustPlaybackAdvanced,
  handleRustQueueSnapshot,
}: UseRustPlaybackLifecycleOptions) {
  async function startRustPlaybackQueue(tracks: Track[], requestedTrack: Track | null, startPosition = 0) {
    playbackTime.value = startPosition;
    const playbackTracks = tracks;
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
    const playbackTracks = player.queue;
    if (playbackTracks.length === 0) return;

    let stopAdvancedListener: (() => void) | null = null;
    try {
      stopAdvancedListener = await listenRustBackendAdvanced((event) => {
        handleRustPlaybackAdvanced(event);
        stopAdvancedListener?.();
        stopAdvancedListener = null;
      });
      await restoreRustBackendQueue(
        playbackTracks,
        track.path || null,
        currentTime,
        player.playbackMode,
        player.settings.seamlessPlayback,
        player.settings.crossfadePlayback,
        crossfadeDurationMs,
      );
      playbackTime.value = currentTime;
    } catch {
      stopAdvancedListener?.();
      rustPlaybackQueue.value = playbackTracks;
    }
  }

  return {
    restoreRustPlaybackQueue,
    startRustPlaybackQueue,
  };
}
