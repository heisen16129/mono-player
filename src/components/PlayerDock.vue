<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { PlaybackMode, Track } from '../types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import {
  pauseRustBackend,
  resumeRustBackend,
  setRustBackendSpeed,
  setRustBackendCacheDir,
  setRustBackendOutputDevice,
  pruneRustBackendCache,
  setRustBackendVolume,
  stopRustBackend,
  type RustQueueSnapshot,
  type RustPlayerState,
} from '../services/playerBackend';
import { resolveLocale, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import { usePlayerDockCover } from '../composables/usePlayerDockCover';
import { usePlayerDockProgress } from '../composables/usePlayerDockProgress';
import { useQueuePopover } from '../composables/useQueuePopover';
import { useRustPlaybackListeners } from '../composables/useRustPlaybackListeners';
import { useSleepTimer, type SleepTimerAction } from '../composables/useSleepTimer';
import NowPlayingInfo from './player-dock/NowPlayingInfo.vue';
import PlaybackErrorToast from './player-dock/PlaybackErrorToast.vue';
import PlaybackMetaControls from './player-dock/PlaybackMetaControls.vue';
import PlaybackProgressBar from './player-dock/PlaybackProgressBar.vue';
import TransportControls from './player-dock/TransportControls.vue';

const props = defineProps<{
  activeTrack: Track | null;
  canControlPlayback: boolean;
  lyricsOpen: boolean;
  isFavorite: boolean;
  onlineQuality: PluginPlaybackQuality;
  onlineQualityOptions: PluginPlaybackQualityOption[];
  lyricFormat: string | null;
  lyricFormats: string[];
  playbackMode: PlaybackMode;
  playbackModeLabel: string;
  queue: Track[];
  restoreRequestId: number;
  restoreTime: number;
  seekRequestId: number;
  seekTime: number;
  isPreparingActiveTrack: boolean;
  showActiveTrackDownload: boolean;
  isActiveTrackDownloaded: boolean;
  isActiveTrackDownloading: boolean;
  showOnlineQuality: boolean;
  showLyricFormat: boolean;
  sleepTimerRequest: { minutes: number; action: SleepTimerAction | null } | null;
  sleepTimerRequestId: number;
  togglePlaybackRequestId: number;
}>();

const emit = defineEmits<{
  mouseenter: [];
  mouseleave: [];
  openDesktopLyrics: [];
  openLyrics: [];
  onlineQualityChange: [quality: PluginPlaybackQuality];
  lyricFormatChange: [format: string];
  downloadActiveTrack: [];
  playNext: [];
  playPrevious: [];
  timeChange: [value: number];
  toggleFavorite: [];
  togglePlaybackMode: [];
  playQueueTrack: [track: Track];
  seamlessAdvance: [track: Track];
  requestInitialPlayback: [startTime?: number];
  sleepTimerExit: [];
  playbackStateChange: [isPlaying: boolean];
  playbackError: [message: string];
  spectrumChange: [levels: number[]];
}>();

const player = usePlayerStore();
const FADE_STATE_HOLD_MS = 900;
const PLAYBACK_ERROR_TIMEOUT_MS = 5200;
const isPlaying = ref(false);
const rustBackendActive = ref(false);
const playbackErrorMessage = ref('');
const rustQueueSnapshot = ref<RustQueueSnapshot | null>(null);
const volume = ref(72);
const previousVolume = ref(72);
const isMuted = ref(false);
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const playbackRate = ref<(typeof playbackRates)[number]>(1);
const spectrumLevels = ref<number[]>([]);
let playbackErrorTimeout = 0;
let lastPreviousTap = 0;
let seamlessQueuedSource = '';
let rustPlaybackStateHoldUntil = 0;

const {
  isQueueOpen,
  locateQueueTrack,
  playQueueTrack,
  setQueueControl,
  setQueueTrackRef,
  toggleQueuePanel,
} = useQueuePopover({
  activeTrack: computed(() => props.activeTrack),
  onPlayTrack: (track) => emit('playQueueTrack', track),
});

const {
  clearSleepTimer,
  closeSleepTimerDialog,
  closeSleepTimerStatus,
  handleSleepTimerButtonClick,
  handleSleepTimerRequest,
  isSleepTimerActive,
  isSleepTimerDialogOpen,
  isSleepTimerPaused,
  isSleepTimerStatusOpen,
  pauseSleepTimer,
  resumeSleepTimer,
  setSleepTimerPreset,
  sleepTimerExecuteAtLabel,
  sleepTimerHours,
  sleepTimerMinutes,
  sleepTimerPresetMinutes,
  sleepTimerProgressPercent,
  sleepTimerRemainingLabel,
  sleepTimerStopAfterTrackPending,
  startSleepTimer,
  syncSleepTimerSetting,
} = useSleepTimer({
  player,
  onStop: stopPlayback,
  onExit: () => emit('sleepTimerExit'),
});

const {
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
} = usePlayerDockProgress({
  activeTrack: computed(() => props.activeTrack),
  isPlaying,
  isPreparingActiveTrack: computed(() => props.isPreparingActiveTrack),
  playbackRate,
  rustBackendActive,
  onError: showPlaybackError,
  onRequestInitialPlayback: (startTime) => emit('requestInitialPlayback', startTime),
  onTimeChange: (value) => emit('timeChange', value),
});

const {
  coverUrl,
  dockStyle,
  handleCoverError,
  hasThemeBackground,
} = usePlayerDockCover({
  activeTrack: computed(() => props.activeTrack),
});

const rustQueueTracks = computed(() => {
  return rustQueueSnapshot.value?.tracks ?? [];
});
const queueTracks = computed(() => {
  return props.queue.length > 0 ? props.queue : rustQueueTracks.value;
});

const playbackRateLabel = computed(() => `${playbackRate.value}x`);
const onlineQualityLabel = computed(() => {
  return props.onlineQualityOptions.find((option) => option.id === props.onlineQuality)?.name ?? props.onlineQuality;
});
const lyricFormatLabel = computed(() => props.lyricFormat?.trim().toLowerCase() || props.lyricFormats[0] || '');

function normalizedBackendPath(path: string | null | undefined) {
  return (path ?? '').replace(/\\/g, '/').toLocaleLowerCase();
}

function isActiveRustPath(path: string | null | undefined) {
  const normalizedPath = normalizedBackendPath(path);
  return normalizedPath === normalizedBackendPath(props.activeTrack?.path)
    || normalizedPath === normalizedBackendPath(seamlessQueuedSource);
}

function findQueueTrackBySource(source: string) {
  const normalizedSource = normalizedBackendPath(source);
  return props.queue.find((track) => normalizedBackendPath(track.path) === normalizedSource) ?? null;
}

function setQueueControlElement(element: unknown) {
  setQueueControl(element instanceof HTMLElement ? element : null);
}

function setQueueTrackElement(trackId: number, element: unknown) {
  setQueueTrackRef(trackId, element instanceof HTMLElement ? element : null);
}

function holdRustPlaybackStoppedState() {
  rustPlaybackStateHoldUntil = player.settings.fadePlayback ? Date.now() + FADE_STATE_HOLD_MS : 0;
}

function playbackErrorText(error: unknown) {
  return getErrorMessage(error, '未知错误');
}

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
  const message = `播放失败：${playbackErrorText(error)}`;
  playbackErrorMessage.value = '';
  emit('playbackError', message);
}

function showPlaybackNotice(message: string) {
  if (playbackErrorTimeout) {
    window.clearTimeout(playbackErrorTimeout);
  }
  playbackErrorMessage.value = message;
  playbackErrorTimeout = window.setTimeout(clearPlaybackError, PLAYBACK_ERROR_TIMEOUT_MS);
}

function outputDeviceFallbackMessage(previousDeviceId: string) {
  if (resolveLocale(player.settings.locale) === 'en-US') {
    return `Output device disconnected. Switched back to system default: ${previousDeviceId}`;
  }

  return `输出设备已断开，已回退到系统默认设备：${previousDeviceId}`;
}

async function resumeAudio() {
  if (!props.activeTrack?.path) return;

  try {
    clearPlaybackError();
    rustPlaybackStateHoldUntil = 0;
    await resumeRustBackend();
    rustBackendActive.value = true;
    isPlaying.value = true;
    syncSmoothProgressBase();
    startSmoothProgress();
    void setRustBackendVolume(isMuted.value ? 0 : volume.value / 100);
    void setRustBackendSpeed(playbackRate.value);
    emit('playbackStateChange', true);
  } catch (error) {
    rustBackendActive.value = false;
    isPlaying.value = false;
    emit('playbackStateChange', false);
    if (getErrorMessage(error).includes('No active audio to resume.')) {
      emit('requestInitialPlayback');
      return;
    }
    showPlaybackError(error);
  }
}

async function loadSource(startTime = 0) {
  if (!props.activeTrack?.path) return;

  void stopRustBackend(false);
  setPlaybackTime(0);
  isPlaying.value = false;
  rustBackendActive.value = false;
  if (startTime > 0) {
    setPlaybackTime(startTime);
  }
}

watch(
  () => props.restoreRequestId,
  async () => {
    if (!props.activeTrack?.path) return;
    await loadSource(props.restoreTime);
  },
  { flush: 'post' },
);

watch(
  () => [props.activeTrack?.id, props.activeTrack?.path] as const,
  () => {
    runtimeDuration.value = 0;
    setPlaybackTime(0);
  },
);

watch(
  () => props.isPreparingActiveTrack,
  (preparing) => {
    if (!preparing) return;
    rustBackendActive.value = false;
    isPlaying.value = false;
    setPlaybackTime(0);
    stopSmoothProgress();
  },
);

watch(
  () => props.seekRequestId,
  () => seekPlaybackTo(props.seekTime),
  { flush: 'post' },
);

watch(
  () => props.sleepTimerRequestId,
  () => {
    handleSleepTimerRequest(props.sleepTimerRequest);
  },
);

watch(
  () => props.togglePlaybackRequestId,
  async () => {
    await togglePlayback();
  },
  { flush: 'post' },
);

watch(
  () => props.activeTrack?.path,
  (path) => {
    if (seamlessQueuedSource && normalizedBackendPath(path) === normalizedBackendPath(seamlessQueuedSource)) {
      seamlessQueuedSource = '';
    }
  },
);

async function togglePlayback() {
  if (!props.activeTrack?.path) return;

  if (!props.canControlPlayback || !rustBackendActive.value) {
    emit('requestInitialPlayback');
    return;
  }

  if (isPlaying.value) {
    holdRustPlaybackStoppedState();
    try {
      await pauseRustBackend(player.settings.fadePlayback);
    } catch (error) {
      showPlaybackError(error);
      return;
    }
    isPlaying.value = false;
    stopSmoothProgress();
    emit('playbackStateChange', false);
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
  playbackRate.value = Math.min(2, Math.max(0.5, nextRate)) as (typeof playbackRates)[number];
  syncSmoothProgressBase();
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
  stopSmoothProgress();
  emit('playbackStateChange', false);
}

function requestPreviousTrack() {
  const now = window.performance.now();
  if (now - lastPreviousTap < 120) return;
  lastPreviousTap = now;
  emit('playPrevious');
}

function requestNextTrack() {
  emit('playNext');
}

function requestPlaybackModeToggle() {
  emit('togglePlaybackMode');
}

function requestFavoriteToggle() {
  emit('toggleFavorite');
}

watch(
  () => player.settings.sleepTimerMinutes,
  (minutes) => {
    syncSleepTimerSetting(minutes);
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

function handleRustPlaybackState(state: RustPlayerState) {
  if (!isActiveRustPath(state.currentPath)) {
    if (rustBackendActive.value) {
      rustBackendActive.value = false;
      isPlaying.value = false;
      stopSmoothProgress();
      emit('playbackStateChange', false);
    }
    spectrumLevels.value = [];
    runtimeDuration.value = 0;
    emit('spectrumChange', []);
    return;
  }

  rustBackendActive.value = true;
  spectrumLevels.value = state.isPlaying ? (state.spectrumLevels ?? []) : [];
  if (!props.activeTrack?.duration && state.duration && state.duration > 0) {
    runtimeDuration.value = state.duration;
  }
  emit('spectrumChange', spectrumLevels.value);
  syncPlaybackTimeFromRust(state.position, state.isPlaying);

  if (!state.isPlaying) {
    rustPlaybackStateHoldUntil = 0;
  }
  if (!isPlaying.value && state.isPlaying && Date.now() < rustPlaybackStateHoldUntil) {
    return;
  }

  if (isPlaying.value !== state.isPlaying) {
    isPlaying.value = state.isPlaying;
    emit('playbackStateChange', state.isPlaying);
  }
}

useRustPlaybackListeners({
  onAdvanced: (source) => {
    if (sleepTimerStopAfterTrackPending.value) {
      sleepTimerStopAfterTrackPending.value = false;
      void stopRustBackend(false);
      return;
    }
    const queuedTrack = findQueueTrackBySource(source);
    if (!queuedTrack) return;

    setPlaybackTime(0);
    emit('seamlessAdvance', queuedTrack);
    seamlessQueuedSource = source;
  },
  onState: handleRustPlaybackState,
  onQueue: (snapshot) => {
    rustQueueSnapshot.value = snapshot;
  },
  onOutputDeviceFallback: (event) => {
    if (player.settings.audioOutputDeviceId) {
      player.setAudioOutputDeviceId('');
    }
    showPlaybackNotice(outputDeviceFallbackMessage(event.previousDeviceId));
  },
  onEnded: () => {
    if (!rustBackendActive.value) return;

    if (sleepTimerStopAfterTrackPending.value) {
      sleepTimerStopAfterTrackPending.value = false;
      isPlaying.value = false;
      rustBackendActive.value = false;
      stopSmoothProgress();
      emit('playbackStateChange', false);
      return;
    }
    isPlaying.value = false;
    rustBackendActive.value = false;
    stopSmoothProgress();
    emit('playbackStateChange', false);
  },
});

onBeforeUnmount(() => {
  void stopRustBackend(false);
  stopSmoothProgress();
  clearSleepTimer();
  clearPlaybackError();
});
</script>

<template>
  <footer
    class="player-dock"
    :class="{ 'has-cover-background': coverUrl && !hasThemeBackground }"
    :style="dockStyle"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
  >
    <PlaybackProgressBar
      :label="t(player.settings.locale, 'playback')"
      :value="progress"
      @input="previewSeekAudio"
      @change="commitSeekAudio"
    />

    <PlaybackErrorToast :message="playbackErrorMessage" @close="clearPlaybackError" />

    <NowPlayingInfo
      :active-track="activeTrack"
      :cover-url="coverUrl"
      :current-time="currentTime"
      :locale="player.settings.locale"
      :lyrics-open="lyricsOpen"
      :total-duration-label="totalDurationLabel"
      @cover-error="handleCoverError"
      @open-lyrics="emit('openLyrics')"
    />

    <TransportControls
      :active-track="activeTrack"
      :is-favorite="isFavorite"
      :is-playing="isPlaying"
      :locale="player.settings.locale"
      :playback-mode="playbackMode"
      :playback-mode-label="playbackModeLabel"
      @next="requestNextTrack"
      @previous="requestPreviousTrack"
      @toggle-favorite="requestFavoriteToggle"
      @toggle-playback="togglePlayback"
      @toggle-playback-mode="requestPlaybackModeToggle"
    />

    <PlaybackMetaControls
      :active-track="activeTrack"
      :is-active-track-downloaded="isActiveTrackDownloaded"
      :is-active-track-downloading="isActiveTrackDownloading"
      :is-muted="isMuted"
      :is-playing="isPlaying"
      :is-preparing-active-track="isPreparingActiveTrack"
      :is-queue-open="isQueueOpen"
      :is-sleep-timer-active="isSleepTimerActive"
      :is-sleep-timer-dialog-open="isSleepTimerDialogOpen"
      :is-sleep-timer-paused="isSleepTimerPaused"
      :is-sleep-timer-status-open="isSleepTimerStatusOpen"
      :locale="player.settings.locale"
      :lyric-format="lyricFormat"
      :lyric-format-label="lyricFormatLabel"
      :lyric-formats="lyricFormats"
      :online-quality="onlineQuality"
      :online-quality-label="onlineQualityLabel"
      :online-quality-options="onlineQualityOptions"
      :playback-rate="playbackRate"
      :playback-rate-label="playbackRateLabel"
      :queue-tracks="queueTracks"
      :show-active-track-download="showActiveTrackDownload"
      :show-lyric-format="showLyricFormat"
      :show-online-quality="showOnlineQuality"
      :show-track-covers="player.settings.showTrackCovers"
      :show-track-numbers="player.settings.showTrackNumbers"
      :sleep-timer-action="player.settings.sleepTimerAction"
      :sleep-timer-execute-at-label="sleepTimerExecuteAtLabel"
      :sleep-timer-hours="sleepTimerHours"
      :sleep-timer-minutes="sleepTimerMinutes"
      :sleep-timer-preset-minutes="sleepTimerPresetMinutes"
      :sleep-timer-progress-percent="sleepTimerProgressPercent"
      :sleep-timer-remaining-label="sleepTimerRemainingLabel"
      :spectrum-levels="spectrumLevels"
      :volume="volume"
      @clear-sleep-timer="clearSleepTimer"
      @close-sleep-timer-dialog="closeSleepTimerDialog"
      @close-sleep-timer-status="closeSleepTimerStatus"
      @download-active-track="emit('downloadActiveTrack')"
      @locate-queue-track="locateQueueTrack"
      @lyric-format-change="emit('lyricFormatChange', $event)"
      @online-quality-change="emit('onlineQualityChange', $event)"
      @open-desktop-lyrics="emit('openDesktopLyrics')"
      @pause-sleep-timer="pauseSleepTimer"
      @play-queue-track="playQueueTrack"
      @resume-sleep-timer="resumeSleepTimer"
      @set-queue-control="setQueueControlElement"
      @set-queue-track-ref="setQueueTrackElement"
      @set-sleep-timer-action="player.setSleepTimerAction"
      @set-sleep-timer-hours="sleepTimerHours = $event"
      @set-sleep-timer-minutes="sleepTimerMinutes = $event"
      @set-sleep-timer-preset="setSleepTimerPreset"
      @start-sleep-timer="startSleepTimer"
      @toggle-mute="toggleMute"
      @toggle-queue-panel="toggleQueuePanel"
      @toggle-sleep-timer="handleSleepTimerButtonClick"
      @update-playback-rate="changePlaybackRate"
      @update-volume="changeVolume"
    />

  </footer>
</template>

<style scoped>
.player-dock {
  position: relative;
  z-index: 30;
  grid-row: 2;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(240px, 390px) minmax(340px, 1.35fr);
  gap: 14px;
  align-items: center;
  min-height: var(--player-height);
  padding: 10px 20px;
  border-top: 1px solid var(--smw-window-border);
  background: var(--smw-player-bg);
  transition:
    transform 260ms cubic-bezier(0.22, 0.76, 0.22, 1),
    opacity 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
  will-change: transform, opacity;
}


</style>
