import type { Ref } from 'vue';
import type { DesktopLyricsAction } from '../services/desktopLyrics';
import type { PlaybackMode } from '../types/music';

interface UseExternalPlaybackActionsOptions {
  togglePlaybackRequestId: Ref<number>;
  openSettingsView: () => void;
  playNextTrack: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  setPlaybackMode: (mode: PlaybackMode) => Promise<void> | void;
}

export function useExternalPlaybackActions({
  togglePlaybackRequestId,
  openSettingsView,
  playNextTrack,
  playPreviousTrack,
  setPlaybackMode,
}: UseExternalPlaybackActionsOptions) {
  function requestTogglePlayback() {
    togglePlaybackRequestId.value += 1;
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

  return {
    handleDesktopLyricsAction,
    handleTrayMenuAction,
  };
}
