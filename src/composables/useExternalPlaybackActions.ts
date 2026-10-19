import type { Ref } from 'vue';
import type { DesktopLyricsAction } from '../services/desktopLyrics';

interface UseExternalPlaybackActionsOptions {
  togglePlaybackRequestId: Ref<number>;
  openSettingsView: () => void;
  playNextTrack: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  seekToLyric: (time: number) => Promise<void>;
}

export function useExternalPlaybackActions({
  togglePlaybackRequestId,
  openSettingsView,
  playNextTrack,
  playPreviousTrack,
  seekToLyric,
}: UseExternalPlaybackActionsOptions) {
  function requestTogglePlayback() {
    togglePlaybackRequestId.value += 1;
  }

  async function handleTrayMenuAction(action: string) {
    if (action === 'settings') {
      openSettingsView();
    }
  }

  async function handleDesktopLyricsAction(action: DesktopLyricsAction) {
    if (typeof action === 'object' && action?.type === 'seek') {
      if (Number.isFinite(action.time)) await seekToLyric(Math.max(0, action.time));
      return;
    }
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
