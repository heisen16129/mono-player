import type { Ref } from 'vue';
import { playRustBackendNext, playRustBackendPrevious, stopRustBackend, type RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import { isPlaybackRequestReplacedError, normalizePlaybackErrorMessage } from '../utils/playback';

interface UseRustPlaybackTransportOptions {
  isAudioPlaying: Ref<boolean>;
  queueSwitchingTrackKey: Ref<string | null>;
  player: ReturnType<typeof usePlayerStore>;
  clearPreparingPlaybackState: () => void;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  showToast: (message: string) => void;
}

export function useRustPlaybackTransport({
  isAudioPlaying,
  queueSwitchingTrackKey,
  player,
  clearPreparingPlaybackState,
  handleRustQueueSnapshot,
  showToast,
}: UseRustPlaybackTransportOptions) {
  async function playPreviousTrack() {
    isAudioPlaying.value = false;
    try {
      handleRustQueueSnapshot(await playRustBackendPrevious());
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return;
      queueSwitchingTrackKey.value = null;
      const message = normalizePlaybackErrorMessage(error, '切换上一首失败');
      player.error = null;
      showToast(message);
    }
  }

  async function playNextTrack() {
    isAudioPlaying.value = false;
    try {
      handleRustQueueSnapshot(await playRustBackendNext());
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return;
      queueSwitchingTrackKey.value = null;
      const message = normalizePlaybackErrorMessage(error, '切换下一首失败');
      player.error = null;
      showToast(message);
    }
  }

  async function handlePlaybackFailure(message: string) {
    clearPreparingPlaybackState();
    player.error = null;
    await stopRustBackend(false);
    isAudioPlaying.value = false;

    showToast(message);
  }

  return {
    handlePlaybackFailure,
    playNextTrack,
    playPreviousTrack,
  };
}
