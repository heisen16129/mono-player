import type { Ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { normalizePath } from '../utils/path';
import { isPlaybackRequestReplacedError, normalizePlaybackErrorMessage } from '../utils/playback';
import { isSameQueueSource } from '../utils/queueSource';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseActivePlaybackSeekActionsOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  rustPlaybackQueue: ReadonlyRefValue<Track[]>;
  seekRequestId: Ref<number>;
  seekTime: Ref<number>;
  visibleTracks: ReadonlyRefValue<Track[]>;
  player: ReturnType<typeof usePlayerStore>;
  clearPreparingPlaybackState: () => void;
  showToast: (message: string) => void;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useActivePlaybackSeekActions({
  activeTrack,
  rustPlaybackQueue,
  seekRequestId,
  seekTime,
  visibleTracks,
  player,
  clearPreparingPlaybackState,
  showToast,
  startRustPlaybackQueue,
}: UseActivePlaybackSeekActionsOptions) {
  async function playActiveTrack(startTime = 0) {
    const track = activeTrack.value;
    if (!track?.path) return;
    const currentQueue = rustPlaybackQueue.value.length ? rustPlaybackQueue.value : visibleTracks.value;
    const queueHasTrack = currentQueue.some((item) => (
      item.id === track.id
      || normalizePath(item.path) === normalizePath(track.path)
      || isSameQueueSource(item, track)
    ));
    player.error = null;
    try {
      await startRustPlaybackQueue(queueHasTrack ? currentQueue : [track], track, startTime);
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return;
      clearPreparingPlaybackState();
      const message = normalizePlaybackErrorMessage(error, '播放失败');
      showToast(message);
    }
  }

  async function seekToLyric(time: number) {
    if (!player.currentSource && activeTrack.value?.path) {
      await playActiveTrack(time);
      return;
    }

    seekTime.value = time;
    seekRequestId.value += 1;
  }

  return {
    playActiveTrack,
    seekToLyric,
  };
}
