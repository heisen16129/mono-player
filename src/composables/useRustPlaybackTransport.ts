import type { Ref } from 'vue';
import { playRustBackendNext, playRustBackendPrevious, stopRustBackend, type RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import { isPlaybackRequestReplacedError, normalizePlaybackErrorMessage } from '../utils/playback';

interface UseRustPlaybackTransportOptions {
  isAudioPlaying: Ref<boolean>;
  player: ReturnType<typeof usePlayerStore>;
  clearPreparingPlaybackState: () => void;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  showToast: (message: string) => void;
}

export function useRustPlaybackTransport({
  isAudioPlaying,
  player,
  clearPreparingPlaybackState,
  handleRustQueueSnapshot,
  showToast,
}: UseRustPlaybackTransportOptions) {
  async function playPreviousTrack() {
    try {
      handleRustQueueSnapshot(await playRustBackendPrevious());
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return;
      const message = normalizePlaybackErrorMessage(error, '切换上一首失败');
      player.error = null;
      showToast(message);
    }
  }

  async function playNextTrack() {
    try {
      handleRustQueueSnapshot(await playRustBackendNext());
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return;
      const message = normalizePlaybackErrorMessage(error, '切换下一首失败');
      player.error = null;
      showToast(message);
    }
  }

  async function handlePlaybackFailure(message: string) {
    clearPreparingPlaybackState();
    player.error = null;
    isAudioPlaying.value = false;
    try {
      await stopRustBackend(false);
    } catch {
      // The playback state must remain stopped even if the failed worker cannot respond.
    }

    showToast(message);
  }

  return {
    handlePlaybackFailure,
    playNextTrack,
    playPreviousTrack,
  };
}
