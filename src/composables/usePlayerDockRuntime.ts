import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useRustPlaybackListeners } from './useRustPlaybackListeners';
import {
  pauseRustBackend,
  pruneRustBackendCache,
  resumeRustBackend,
  setRustBackendCacheDir,
  setRustBackendOutputDevice,
  setRustBackendSpeed,
  setRustBackendVolume,
  stopRustBackend,
  type RustPlayerState,
  type RustQueueSnapshot,
} from '../services/playerBackend';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import { queueSourceKey } from '../utils/queueSource';
import { resolveRustQueueSnapshotTrack } from '../utils/rustQueueSnapshot';

interface PlayerDockProgressRuntime {
  runtimeDuration: Ref<number>;
  setPlaybackTime: (value: number) => void;
  startSmoothProgress: () => void;
  stopSmoothProgress: (syncExternal?: boolean) => void;
  syncPlaybackTimeFromRust: (position: number, playing: boolean) => void;
  syncSmoothProgressBase: () => void;
}

interface PlayerDockRuntimeOptions {
  activeTrack: ComputedRef<Track | null>;
  canControlPlayback: ComputedRef<boolean>;
  isPlaying: Ref<boolean>;
  isPreparingActiveTrack: ComputedRef<boolean>;
  playbackRate: Ref<number>;
  progress: PlayerDockProgressRuntime;
  queue: ComputedRef<Track[]>;
  restoreRequestId: ComputedRef<number>;
  restoreTime: ComputedRef<number>;
  rustBackendActive: Ref<boolean>;
  togglePlaybackRequestId: ComputedRef<number>;
  onOutputDeviceFallback: (previousDeviceId: string) => void;
  onClearPlaybackError: () => void;
  onPlaybackError: (error: unknown) => void;
  onPlaybackNotice: (message: string) => void;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onRequestInitialPlayback: (startTime?: number) => void;
  onSeamlessAdvance: (track: Track) => void;
}

const FADE_STATE_HOLD_MS = 900;
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function usePlayerDockRuntime({
  activeTrack,
  canControlPlayback,
  isPlaying,
  isPreparingActiveTrack,
  playbackRate,
  progress,
  queue,
  restoreRequestId,
  restoreTime,
  rustBackendActive,
  togglePlaybackRequestId,
  onOutputDeviceFallback,
  onClearPlaybackError,
  onPlaybackError,
  onPlaybackNotice,
  onPlaybackStateChange,
  onRequestInitialPlayback,
  onSeamlessAdvance,
}: PlayerDockRuntimeOptions) {
  const player = usePlayerStore();
  const rustQueueSnapshot = ref<RustQueueSnapshot | null>(null);
  const volume = ref(72);
  const previousVolume = ref(72);
  const isMuted = ref(false);
  let seamlessQueuedSource = '';
  let rustPlaybackStateHoldUntil = 0;

  const rustQueueTracks = computed(() => rustQueueSnapshot.value?.tracks ?? []);
  const queueTracks = computed(() => queue.value.length > 0 ? queue.value : rustQueueTracks.value);

  function normalizedBackendPath(path: string | null | undefined) {
    return (path ?? '').replace(/\\/g, '/').toLocaleLowerCase();
  }

  function currentQueueTrack() {
    const snapshot = rustQueueSnapshot.value;
    return snapshot ? resolveRustQueueSnapshotTrack(snapshot, snapshot.tracks) : null;
  }

  function playbackTrackIdentity(track: Track | null | undefined) {
    if (!track) return '';
    const providerId = track.sourceProviderId?.trim();
    const sourceId = track.sourceId?.trim();
    if (providerId && sourceId) return `plugin:${providerId}:${sourceId}`;
    return `${track.id}:${track.path}`;
  }

  function isActiveRustPath(path: string | null | undefined) {
    const normalizedPath = normalizedBackendPath(path);
    return normalizedPath === normalizedBackendPath(activeTrack.value?.path)
      || normalizedPath === normalizedBackendPath(rustQueueSnapshot.value?.currentSource)
      || normalizedPath === normalizedBackendPath(seamlessQueuedSource);
  }

  function findQueueTrackBySource(source: string) {
    const normalizedSource = normalizedBackendPath(source);
    const track = queue.value.find((track) => (
      normalizedBackendPath(track.path) === normalizedSource
      || normalizedBackendPath(queueSourceKey(track)) === normalizedSource
    ));
    if (track) return track;
    if (normalizedSource === normalizedBackendPath(rustQueueSnapshot.value?.currentSource)) {
      return currentQueueTrack();
    }
    return null;
  }

  function holdRustPlaybackStoppedState() {
    rustPlaybackStateHoldUntil = player.settings.fadePlayback ? Date.now() + FADE_STATE_HOLD_MS : 0;
  }

  async function resumeAudio() {
    if (!activeTrack.value?.path) return;

    try {
      onClearPlaybackError();
      rustPlaybackStateHoldUntil = 0;
      await resumeRustBackend();
      rustBackendActive.value = true;
      isPlaying.value = true;
      progress.syncSmoothProgressBase();
      progress.startSmoothProgress();
      void setRustBackendVolume(isMuted.value ? 0 : volume.value / 100);
      void setRustBackendSpeed(playbackRate.value);
      onPlaybackStateChange(true);
    } catch (error) {
      rustBackendActive.value = false;
      isPlaying.value = false;
      onPlaybackStateChange(false);
      if (getErrorMessage(error).includes('No active audio to resume.')) {
        onRequestInitialPlayback();
        return;
      }
      onPlaybackError(error);
    }
  }

  async function loadSource(startTime = 0) {
    if (!activeTrack.value?.path) return;

    void stopRustBackend(false);
    progress.setPlaybackTime(0);
    isPlaying.value = false;
    rustBackendActive.value = false;
    if (startTime > 0) {
      progress.setPlaybackTime(startTime);
    }
  }

  async function togglePlayback() {
    if (!activeTrack.value?.path) return;

    if (isPlaying.value) {
      holdRustPlaybackStoppedState();
      isPlaying.value = false;
      progress.stopSmoothProgress();
      onPlaybackStateChange(false);
      try {
        await pauseRustBackend(player.settings.fadePlayback);
      } catch (error) {
        isPlaying.value = true;
        progress.syncSmoothProgressBase();
        progress.startSmoothProgress();
        onPlaybackStateChange(true);
        onPlaybackError(error);
        return;
      }
      return;
    }

    if (isPreparingActiveTrack.value) return;
    if (!canControlPlayback.value || !rustBackendActive.value) {
      onRequestInitialPlayback();
      return;
    }

    await resumeAudio();
  }

  function applyVolume() {
    if (rustBackendActive.value) {
      void setRustBackendVolume(isMuted.value ? 0 : volume.value / 100);
    }
  }

  function changePlaybackRate(nextRate: number) {
    playbackRate.value = Math.min(2, Math.max(0.5, nextRate));
    progress.syncSmoothProgressBase();
    if (rustBackendActive.value) {
      void setRustBackendSpeed(playbackRate.value);
    }
  }

  function changeVolume(value: number) {
    volume.value = value;
    if (volume.value > 0) {
      previousVolume.value = volume.value;
      isMuted.value = false;
    } else {
      isMuted.value = true;
    }
    applyVolume();
  }

  function toggleMute() {
    if (isMuted.value) {
      isMuted.value = false;
      volume.value = previousVolume.value || 72;
    } else {
      previousVolume.value = volume.value || previousVolume.value || 72;
      isMuted.value = true;
    }
    applyVolume();
  }

  function stopPlayback() {
    if (rustBackendActive.value) {
      holdRustPlaybackStoppedState();
      void stopRustBackend(player.settings.fadePlayback);
    }
    isPlaying.value = false;
    progress.stopSmoothProgress();
    onPlaybackStateChange(false);
  }

  function handleRustPlaybackState(state: RustPlayerState) {
    if (!isActiveRustPath(state.currentPath)) {
      if (rustBackendActive.value) {
        rustBackendActive.value = false;
        isPlaying.value = false;
        progress.stopSmoothProgress();
        onPlaybackStateChange(false);
      }
      progress.runtimeDuration.value = 0;
      return;
    }

    rustBackendActive.value = true;
    const isHoldingStoppedState = !isPlaying.value && state.isPlaying && Date.now() < rustPlaybackStateHoldUntil;
    if (!activeTrack.value?.duration && state.duration && state.duration > 0) {
      progress.runtimeDuration.value = state.duration;
    }
    if (isHoldingStoppedState) {
      progress.stopSmoothProgress();
      return;
    }

    progress.syncPlaybackTimeFromRust(state.position, state.isPlaying);

    if (!state.isPlaying) {
      rustPlaybackStateHoldUntil = 0;
    }

    if (isPlaying.value !== state.isPlaying) {
      isPlaying.value = state.isPlaying;
    }
    onPlaybackStateChange(state.isPlaying);
  }

  watch(
    restoreRequestId,
    async () => {
      if (!activeTrack.value?.path) return;
      await loadSource(restoreTime.value);
    },
    { flush: 'post' },
  );

  watch(
    () => playbackTrackIdentity(activeTrack.value),
    () => {
      progress.runtimeDuration.value = 0;
      progress.setPlaybackTime(0);
    },
  );

  watch(
    isPreparingActiveTrack,
    (preparing) => {
      if (!preparing) return;
      rustBackendActive.value = false;
      isPlaying.value = false;
      progress.setPlaybackTime(0);
      progress.stopSmoothProgress();
    },
  );

  watch(
    togglePlaybackRequestId,
    async () => {
      await togglePlayback();
    },
    { flush: 'post' },
  );

  watch(
    () => activeTrack.value?.path,
    (path) => {
      if (seamlessQueuedSource && normalizedBackendPath(path) === normalizedBackendPath(seamlessQueuedSource)) {
        seamlessQueuedSource = '';
      }
    },
  );

  watch(
    () => player.settings.audioCacheDir,
    (cacheDir) => {
      void setRustBackendCacheDir(cacheDir || null);
      void pruneRustBackendCache(player.settings.audioCacheMaxMb * 1024 * 1024);
    },
    { immediate: true },
  );

  watch(
    () => player.settings.audioCacheMaxMb,
    (sizeMb) => {
      void pruneRustBackendCache(sizeMb * 1024 * 1024);
    },
    { immediate: true },
  );

  watch(
    () => player.settings.audioOutputDeviceId,
    (deviceId) => {
      void setRustBackendOutputDevice(deviceId || null);
    },
    { immediate: true },
  );

  useRustPlaybackListeners({
    onAdvanced: (source) => {
      const queuedTrack = findQueueTrackBySource(source);
      if (!queuedTrack) return;

      progress.setPlaybackTime(0);
      onSeamlessAdvance(queuedTrack);
      seamlessQueuedSource = source;
    },
    onState: handleRustPlaybackState,
    onQueue: (snapshot) => {
      rustQueueSnapshot.value = snapshot;
    },
    onError: (message) => {
      rustBackendActive.value = false;
      isPlaying.value = false;
      progress.stopSmoothProgress();
      onPlaybackStateChange(false);
      onPlaybackNotice(message);
    },
    onOutputDeviceFallback: (event) => {
      if (player.settings.audioOutputDeviceId) {
        player.setAudioOutputDeviceId('');
      }
      onOutputDeviceFallback(event.previousDeviceId);
    },
    onEnded: () => {
      if (!rustBackendActive.value) return;

      isPlaying.value = false;
      rustBackendActive.value = false;
      progress.stopSmoothProgress();
      onPlaybackStateChange(false);
    },
  });

  onBeforeUnmount(() => {
    void stopRustBackend(false);
    progress.stopSmoothProgress();
  });

  return {
    changePlaybackRate,
    changeVolume,
    isMuted,
    isPlaying,
    playbackRate,
    playbackRates,
    queueTracks,
    rustBackendActive,
    rustQueueSnapshot,
    stopPlayback,
    toggleMute,
    togglePlayback,
    volume,
  };
}
