import type { Ref } from 'vue';
import type { RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { useRustPlaybackLifecycle } from './useRustPlaybackLifecycle';
import { useRustPlaybackQueueBridge } from './useRustPlaybackQueueBridge';
import { useRustPlaybackTransport } from './useRustPlaybackTransport';
import { useRustQueueCommands } from './useRustQueueCommands';
import { useRustQueueSnapshotController } from './useRustQueueSnapshotController';

interface UseAppRustPlaybackRuntimeOptions {
  currentPlaybackTrack: Ref<Track | null>;
  isAudioPlaying: Ref<boolean>;
  onlineActivePluginTrack: Ref<PluginSearchTrack | null>;
  onlineActiveTrack: Ref<Track | null>;
  onlineActiveTrackKey: Ref<string | null>;
  onlinePlaybackSource: Ref<string>;
  playbackTime: Ref<number>;
  queueSwitchingTrackKey: Ref<string | null>;
  restorePlaybackTime: Ref<number>;
  rustPlaybackQueue: Ref<Track[]>;
  selectedTrack: Ref<Track | null>;
  player: ReturnType<typeof usePlayerStore>;
  clearPreparingPlaybackState: () => void;
  clearQueueSwitchingForTrack: (track: Track | null) => void;
  dedupePlaybackQueue: (tracks: Track[]) => Track[];
  findPluginTrackForQueueTrack: (track: Track) => PluginSearchTrack | null;
  getOnlineTrackKey: (track: PluginSearchTrack) => string;
  loadLocalTrackLyricsInBackground: (track: Track) => Promise<void> | void;
  loadPlaybackTrackLyricsInBackground: (track: PluginSearchTrack, playbackTrack: Track) => Promise<void> | void;
  retryActiveDownloadedOnlineTrackFromPlugin: (startPosition?: number) => Promise<boolean>;
  showToast: (message: string, variant?: 'success' | 'error') => void;
  syncLyricsViewStateForTrack: (track: Track | null) => void;
  crossfadeDurationMs: number;
}

export function useAppRustPlaybackRuntime({
  currentPlaybackTrack,
  isAudioPlaying,
  onlineActivePluginTrack,
  onlineActiveTrack,
  onlineActiveTrackKey,
  onlinePlaybackSource,
  playbackTime,
  queueSwitchingTrackKey,
  restorePlaybackTime,
  rustPlaybackQueue,
  selectedTrack,
  player,
  clearPreparingPlaybackState,
  clearQueueSwitchingForTrack,
  dedupePlaybackQueue,
  findPluginTrackForQueueTrack,
  getOnlineTrackKey,
  loadLocalTrackLyricsInBackground,
  loadPlaybackTrackLyricsInBackground,
  retryActiveDownloadedOnlineTrackFromPlugin,
  showToast,
  syncLyricsViewStateForTrack,
  crossfadeDurationMs,
}: UseAppRustPlaybackRuntimeOptions) {
  let rustPlaybackQueueBridge: ReturnType<typeof useRustPlaybackQueueBridge>;

  function handleRustQueueSnapshot(snapshot: RustQueueSnapshot, markPreparing = true) {
    rustPlaybackQueueBridge.handleRustQueueSnapshot(snapshot, markPreparing);
  }

  async function startRustPlaybackQueue(tracks: Track[], requestedTrack: Track | null, startPosition = 0) {
    return rustPlaybackQueueBridge.startRustPlaybackQueue(tracks, requestedTrack, startPosition);
  }

  async function restoreRustPlaybackQueue(track: Track, currentTime: number) {
    await rustPlaybackQueueBridge.restoreRustPlaybackQueue(track, currentTime);
  }

  const rustQueueSnapshotController = useRustQueueSnapshotController({
    currentPlaybackTrack,
    isAudioPlaying,
    onlineActivePluginTrack,
    onlineActiveTrack,
    onlineActiveTrackKey,
    onlinePlaybackSource,
    playbackTime,
    queueSwitchingTrackKey,
    rustPlaybackQueue,
    selectedTrack,
    player,
    clearQueueSwitchingForTrack,
    dedupePlaybackQueue,
    findPluginTrackForQueueTrack,
    getOnlineTrackKey,
    loadLocalTrackLyricsInBackground,
    loadPlaybackTrackLyricsInBackground,
    syncLyricsViewStateForTrack,
  });

  const {
    removeTrackFromRustQueue,
    setPlaybackMode,
    togglePlaybackMode,
  } = useRustQueueCommands({
    handleRustQueueSnapshot,
    player,
    showToast,
  });

  const {
    getIsRestoringPlaybackQueue,
    restoreRustPlaybackQueue: restoreRustPlaybackQueueInRust,
    startRustPlaybackQueue: startRustPlaybackQueueInRust,
  } = useRustPlaybackLifecycle({
    playbackTime,
    restorePlaybackTime,
    rustPlaybackQueue,
    player,
    crossfadeDurationMs,
    dedupePlaybackQueue,
    handleRustQueueSnapshot,
  });

  rustPlaybackQueueBridge = useRustPlaybackQueueBridge({
    handleSnapshot: rustQueueSnapshotController.handleRustQueueSnapshot,
    restoreQueue: restoreRustPlaybackQueueInRust,
    startQueue: startRustPlaybackQueueInRust,
  });

  const {
    handlePlaybackFailure,
    playNextTrack,
    playPreviousTrack,
  } = useRustPlaybackTransport({
    isAudioPlaying,
    playbackTime,
    queueSwitchingTrackKey,
    player,
    clearPreparingPlaybackState,
    handleRustQueueSnapshot,
    retryActiveDownloadedOnlineTrackFromPlugin,
    showToast,
  });

  return {
    getIsRestoringPlaybackQueue,
    handlePlaybackFailure,
    handleRustQueueSnapshot,
    playNextTrack,
    playPreviousTrack,
    removeTrackFromRustQueue,
    restoreRustPlaybackQueue,
    rustQueueSnapshotController,
    setPlaybackMode,
    startRustPlaybackQueue,
    togglePlaybackMode,
  };
}
