import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { seekRustBackend } from '../services/playerBackend';
import type { Track } from '../types/music';
import { formatDuration } from '../utils/format';

interface PlayerDockProgressOptions {
  activeTrack: ComputedRef<Track | null>;
  isPlaying: Ref<boolean>;
  isPreparingActiveTrack: ComputedRef<boolean>;
  playbackRate: Ref<number>;
  rustBackendActive: Ref<boolean>;
  onError: (error: unknown) => void;
  onRequestInitialPlayback: (startTime: number) => void;
  onTimeChange: (value: number) => void;
}

export function usePlayerDockProgress({
  activeTrack,
  isPlaying,
  isPreparingActiveTrack,
  playbackRate,
  rustBackendActive,
  onError,
  onRequestInitialPlayback,
  onTimeChange,
}: PlayerDockProgressOptions) {
  const currentTime = ref(0);
  const runtimeDuration = ref(0);
  const isScrubbingProgress = ref(false);
  let smoothProgressFrame = 0;
  let smoothProgressBaseTime = 0;
  let smoothProgressBasePosition = 0;
  let lastSmoothTimeEmit = 0;

  const totalDuration = computed(() => activeTrack.value?.duration || runtimeDuration.value || 0);
  const hasTotalDuration = computed(() => totalDuration.value > 0);
  const totalDurationLabel = computed(() => (hasTotalDuration.value ? formatDuration(totalDuration.value) : '--:--'));
  const progress = computed(() => {
    if (!hasTotalDuration.value) return 0;
    return Math.min(100, (currentTime.value / totalDuration.value) * 100);
  });
  const canAdvancePlaybackTime = computed(() => !isPreparingActiveTrack.value);

  function syncSmoothProgressBase() {
    smoothProgressBasePosition = currentTime.value;
    smoothProgressBaseTime = window.performance.now();
  }

  function setPlaybackTime(value: number, syncExternal = true) {
    currentTime.value = Math.max(0, value);
    syncSmoothProgressBase();
    lastSmoothTimeEmit = smoothProgressBaseTime;
    if (syncExternal) {
      onTimeChange(currentTime.value);
    }
  }

  function stopSmoothProgress() {
    if (!smoothProgressFrame) return;
    window.cancelAnimationFrame(smoothProgressFrame);
    smoothProgressFrame = 0;
  }

  function startSmoothProgress() {
    if (!canAdvancePlaybackTime.value) return;
    if (smoothProgressFrame) return;

    const tick = () => {
      if (!isPlaying.value || !rustBackendActive.value || !canAdvancePlaybackTime.value) {
        smoothProgressFrame = 0;
        return;
      }

      const now = window.performance.now();
      const elapsedSeconds = (now - smoothProgressBaseTime) / 1000;
      const nextTime = smoothProgressBasePosition + elapsedSeconds * playbackRate.value;
      currentTime.value = totalDuration.value ? Math.min(nextTime, totalDuration.value) : nextTime;
      if (now - lastSmoothTimeEmit > 200) {
        lastSmoothTimeEmit = now;
        onTimeChange(currentTime.value);
      }
      smoothProgressFrame = window.requestAnimationFrame(tick);
    };

    smoothProgressFrame = window.requestAnimationFrame(tick);
  }

  function syncPlaybackTimeFromRust(position: number, playing: boolean) {
    if (isScrubbingProgress.value) return;
    if (!canAdvancePlaybackTime.value) {
      setPlaybackTime(0);
      stopSmoothProgress();
      return;
    }

    const nextPosition = Math.max(0, position);
    const now = window.performance.now();
    const estimatedPosition = smoothProgressBasePosition + ((now - smoothProgressBaseTime) / 1000) * playbackRate.value;

    if (!playing || Math.abs(nextPosition - estimatedPosition) > 0.75) {
      currentTime.value = nextPosition;
      onTimeChange(currentTime.value);
    }

    smoothProgressBasePosition = nextPosition;
    smoothProgressBaseTime = now;
    if (playing) {
      startSmoothProgress();
    } else {
      stopSmoothProgress();
    }
  }

  function previewSeekAudio(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!totalDuration.value) return;
    isScrubbingProgress.value = true;
    stopSmoothProgress();
    setPlaybackTime((Number(target.value) / 100) * totalDuration.value, false);
  }

  async function commitSeekAudio() {
    if (!totalDuration.value) return;
    isScrubbingProgress.value = false;
    onTimeChange(currentTime.value);
    if (!rustBackendActive.value) return;

    try {
      await seekRustBackend(currentTime.value);
      syncSmoothProgressBase();
      if (isPlaying.value) {
        startSmoothProgress();
      }
    } catch (error) {
      onError(error);
    }
  }

  async function seekPlaybackTo(seconds: number) {
    if (!activeTrack.value?.path) return;
    if (!rustBackendActive.value) {
      setPlaybackTime(seconds);
      onRequestInitialPlayback(seconds);
      return;
    }

    try {
      await seekRustBackend(seconds);
      setPlaybackTime(seconds);
    } catch (error) {
      onError(error);
    }
  }

  return {
    currentTime,
    progress,
    runtimeDuration,
    totalDurationLabel,
    commitSeekAudio,
    previewSeekAudio,
    seekPlaybackTo,
    setPlaybackTime,
    startSmoothProgress,
    stopSmoothProgress,
    syncPlaybackTimeFromRust,
    syncSmoothProgressBase,
  };
}
