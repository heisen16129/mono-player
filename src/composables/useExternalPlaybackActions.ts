import type { Ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DesktopLyricsAction } from '../services/desktopLyrics';
import type { SystemMediaAction } from '../services/systemMedia';
import type { PlaybackMode } from '../types/music';

interface UseExternalPlaybackActionsOptions {
  isAudioPlaying: Ref<boolean>;
  playbackTime: Ref<number>;
  seekRequestId: Ref<number>;
  seekTime: Ref<number>;
  togglePlaybackRequestId: Ref<number>;
  openSettingsView: () => void;
  playNextTrack: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  requestAppClose: () => Promise<void> | void;
  setPlaybackMode: (mode: PlaybackMode) => Promise<void> | void;
}

export function useExternalPlaybackActions({
  isAudioPlaying,
  playbackTime,
  seekRequestId,
  seekTime,
  togglePlaybackRequestId,
  openSettingsView,
  playNextTrack,
  playPreviousTrack,
  requestAppClose,
  setPlaybackMode,
}: UseExternalPlaybackActionsOptions) {
  function requestTogglePlayback() {
    togglePlaybackRequestId.value += 1;
  }

  function requestSeek(time: number) {
    seekTime.value = Math.max(0, time);
    seekRequestId.value += 1;
  }

  async function handleTrayMenuAction(action: string) {
    if (action === 'toggle-play') {
      requestTogglePlayback();
      return;
    }

    if (action === 'previous') {
      await playPreviousTrack();
      return;
    }

    if (action === 'next') {
      await playNextTrack();
      return;
    }

    if (action === 'mode-shuffle') {
      await setPlaybackMode('shuffle');
      return;
    }

    if (action === 'mode-repeat') {
      await setPlaybackMode('repeat');
      return;
    }

    if (action === 'mode-fixed') {
      await setPlaybackMode('fixed');
      return;
    }

    if (action === 'settings') {
      openSettingsView();
    }
  }

  async function handleDesktopLyricsAction(action: DesktopLyricsAction) {
    if (action === 'previous') {
      await playPreviousTrack();
      return;
    }

    if (action === 'toggle-play') {
      requestTogglePlayback();
      return;
    }

    if (action === 'next') {
      await playNextTrack();
    }
  }

  async function handleSystemMediaAction(event: SystemMediaAction) {
    if (event.action === 'previous') {
      await playPreviousTrack();
      return;
    }

    if (event.action === 'next') {
      await playNextTrack();
      return;
    }

    if (event.action === 'play') {
      if (!isAudioPlaying.value) requestTogglePlayback();
      return;
    }

    if (event.action === 'pause') {
      if (isAudioPlaying.value) requestTogglePlayback();
      return;
    }

    if (event.action === 'toggle') {
      requestTogglePlayback();
      return;
    }

    if (event.action === 'stop') {
      if (isAudioPlaying.value) requestTogglePlayback();
      return;
    }

    if (event.action === 'seek' && typeof event.position === 'number') {
      requestSeek(event.position);
      return;
    }

    if ((event.action === 'seek-forward' || event.action === 'seek-backward') && typeof event.offset === 'number') {
      const direction = event.action === 'seek-forward' ? 1 : -1;
      requestSeek(playbackTime.value + direction * event.offset);
      return;
    }

    if (event.action === 'raise') {
      const window = getCurrentWindow();
      await window.show();
      await window.setFocus();
      return;
    }

    if (event.action === 'quit') {
      await requestAppClose();
    }
  }

  return {
    handleDesktopLyricsAction,
    handleSystemMediaAction,
    handleTrayMenuAction,
  };
}
