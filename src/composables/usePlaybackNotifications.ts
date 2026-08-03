import { onBeforeUnmount, ref } from 'vue';
import { resolveLocale } from '../i18n';
import { getErrorMessage } from '../utils/error';
import type { Locale } from '../types/music';

const PLAYBACK_ERROR_TIMEOUT_MS = 5200;

interface PlaybackNotificationsOptions {
  getLocale: () => Locale;
  onPlaybackError: (message: string) => void;
}

export function usePlaybackNotifications(options: PlaybackNotificationsOptions) {
  const playbackErrorMessage = ref('');
  let playbackErrorTimeout = 0;

  function clearPlaybackError() {
    if (playbackErrorTimeout) {
      window.clearTimeout(playbackErrorTimeout);
      playbackErrorTimeout = 0;
    }
    playbackErrorMessage.value = '';
  }

  function showPlaybackError(error: unknown) {
    if (playbackErrorTimeout) {
      window.clearTimeout(playbackErrorTimeout);
      playbackErrorTimeout = 0;
    }
    const message = `播放失败：${getErrorMessage(error, '未知错误')}`;
    playbackErrorMessage.value = '';
    options.onPlaybackError(message);
  }

  function showPlaybackNotice(message: string) {
    if (playbackErrorTimeout) {
      window.clearTimeout(playbackErrorTimeout);
    }
    playbackErrorMessage.value = message;
    playbackErrorTimeout = window.setTimeout(clearPlaybackError, PLAYBACK_ERROR_TIMEOUT_MS);
  }

  function showOutputDeviceFallbackNotice(previousDeviceId: string) {
    if (resolveLocale(options.getLocale()) === 'en-US') {
      showPlaybackNotice(`Output device disconnected. Switched back to system default: ${previousDeviceId}`);
      return;
    }

    showPlaybackNotice(`输出设备已断开，已回退到系统默认设备：${previousDeviceId}`);
  }

  onBeforeUnmount(clearPlaybackError);

  return {
    clearPlaybackError,
    playbackErrorMessage,
    showOutputDeviceFallbackNotice,
    showPlaybackError,
    showPlaybackNotice,
  };
}
