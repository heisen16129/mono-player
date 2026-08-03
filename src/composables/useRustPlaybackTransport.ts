import type { Ref } from 'vue';
import { playRustBackendNext, playRustBackendPrevious, stopRustBackend, type RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import { isPlaybackRequestReplacedError, normalizePlaybackErrorMessage } from '../utils/playback';

interface UseRustPlaybackTransportOptions {
  isAudioPlaying: Ref<boolean>;
  playbackTime: Ref<number>;
  queueSwitchingTrackKey: Ref<string | null>;
  player: ReturnType<typeof usePlayerStore>;
  clearPreparingPlaybackState: () => void;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  retryActiveDownloadedOnlineTrackFromPlugin: (startPosition?: number) => Promise<boolean>;
  showToast: (message: string) => void;
}

export function useRustPlaybackTransport({
  isAudioPlaying,
  playbackTime,
  queueSwitchingTrackKey,
  player,
  clearPreparingPlaybackState,
  handleRustQueueSnapshot,
  retryActiveDownloadedOnlineTrackFromPlugin,
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

    try {
      if (await retryActiveDownloadedOnlineTrackFromPlugin(playbackTime.value)) {
        return;
      }
    } catch (error) {
      message = normalizePlaybackErrorMessage(error, '在线源播放失败');
    }

    showToast(message);

    if (player.settings.onlinePlaybackFailureAction !== 'next') {
      return;
    }

    try {
      handleRustQueueSnapshot(await playRustBackendNext());
    } catch (error) {
      if (isPlaybackRequestReplacedError(error)) return;
      const nextMessage = normalizePlaybackErrorMessage(error, '没有下一首可播放');
      showToast(nextMessage);
    }
  }

  return {
    handlePlaybackFailure,
    playNextTrack,
    playPreviousTrack,
  };
}
