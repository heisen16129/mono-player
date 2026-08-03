import type { ComputedRef, Ref } from 'vue';
import { useAppEventListeners } from './useAppEventListeners';
import { useExternalPlaybackActions } from './useExternalPlaybackActions';
import { useSystemMediaSync } from './useSystemMediaSync';
import type { DownloadQueueEvent } from '../services/downloads';
import type { RustQueueSnapshot } from '../services/playerBackend';
import type { PlaybackMode, Track } from '../types/music';

interface McpSleepTimerEvent {
  action?: string | null;
  minutes?: number;
}

interface UseExternalPlaybackEventBridgeOptions {
  activeTrack: ComputedRef<Track | null>;
  isAudioPlaying: Ref<boolean>;
  playbackTime: Ref<number>;
  seekRequestId: Ref<number>;
  seekTime: Ref<number>;
  togglePlaybackRequestId: Ref<number>;
  broadcastCurrentDesktopLyricsState: () => Promise<void> | void;
  getIsRestoringPlaybackQueue: () => boolean;
  handleDownloadQueueEvent: (event: DownloadQueueEvent) => void;
  handleMcpSleepTimerEvent: (event: McpSleepTimerEvent) => void;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot, markPreparing?: boolean) => void;
  openSettingsView: () => void;
  playNextTrack: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  requestAppClose: () => Promise<void> | void;
  setPlaybackMode: (mode: PlaybackMode) => Promise<void> | void;
}

export function useExternalPlaybackEventBridge({
  activeTrack,
  isAudioPlaying,
  playbackTime,
  seekRequestId,
  seekTime,
  togglePlaybackRequestId,
  broadcastCurrentDesktopLyricsState,
  getIsRestoringPlaybackQueue,
  handleDownloadQueueEvent,
  handleMcpSleepTimerEvent,
  handleRustQueueSnapshot,
  openSettingsView,
  playNextTrack,
  playPreviousTrack,
  requestAppClose,
  setPlaybackMode,
}: UseExternalPlaybackEventBridgeOptions) {
  useSystemMediaSync({
    activeTrack,
    isAudioPlaying,
    playbackTime,
  });

  const {
    handleDesktopLyricsAction,
    handleSystemMediaAction,
    handleTrayMenuAction,
  } = useExternalPlaybackActions({
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
  });

  const appEventListeners = useAppEventListeners({
    onDesktopLyricsAction: handleDesktopLyricsAction,
    onDesktopLyricsReady: () => {
      void broadcastCurrentDesktopLyricsState();
    },
    onDownloadEvent: handleDownloadQueueEvent,
    onMcpSleepTimer: handleMcpSleepTimerEvent,
    onRustQueueSnapshot: (snapshot) => {
      handleRustQueueSnapshot(snapshot, !getIsRestoringPlaybackQueue());
    },
    onSystemMediaAction: handleSystemMediaAction,
  });

  return {
    handleTrayMenuAction,
    ...appEventListeners,
  };
}
