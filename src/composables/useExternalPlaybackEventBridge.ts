import type { Ref } from 'vue';
import { useAppEventListeners } from './useAppEventListeners';
import { useExternalPlaybackActions } from './useExternalPlaybackActions';
import type { DownloadQueueEvent } from '../services/downloads';
import type { RustQueueSnapshot } from '../services/playerBackend';
import type { PlaybackMode } from '../types/music';

interface UseExternalPlaybackEventBridgeOptions {
  togglePlaybackRequestId: Ref<number>;
  broadcastCurrentDesktopLyricsState: () => Promise<void> | void;
  getIsRestoringPlaybackQueue: () => boolean;
  handleDownloadQueueEvent: (event: DownloadQueueEvent) => void;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot, markPreparing?: boolean) => void;
  openSettingsView: () => void;
  playNextTrack: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  setPlaybackMode: (mode: PlaybackMode) => Promise<void> | void;
}

export function useExternalPlaybackEventBridge({
  togglePlaybackRequestId,
  broadcastCurrentDesktopLyricsState,
  getIsRestoringPlaybackQueue,
  handleDownloadQueueEvent,
  handleRustQueueSnapshot,
  openSettingsView,
  playNextTrack,
  playPreviousTrack,
  setPlaybackMode,
}: UseExternalPlaybackEventBridgeOptions) {
  const {
    handleDesktopLyricsAction,
    handleTrayMenuAction,
  } = useExternalPlaybackActions({
    togglePlaybackRequestId,
    openSettingsView,
    playNextTrack,
    playPreviousTrack,
    setPlaybackMode,
  });

  const appEventListeners = useAppEventListeners({
    onDesktopLyricsAction: handleDesktopLyricsAction,
    onDesktopLyricsReady: () => {
      void broadcastCurrentDesktopLyricsState();
    },
    onDownloadEvent: handleDownloadQueueEvent,
    onRustQueueSnapshot: (snapshot) => {
      handleRustQueueSnapshot(snapshot, !getIsRestoringPlaybackQueue());
    },
  });

  return {
    handleTrayMenuAction,
    ...appEventListeners,
  };
}
