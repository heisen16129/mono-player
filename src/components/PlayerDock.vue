<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePlayerStore } from '../stores/player';
import { useInAppShortcuts } from '../composables/useInAppShortcuts';
import { usePlaybackNotifications } from '../composables/usePlaybackNotifications';
import { usePlayerDockControlBindings } from '../composables/usePlayerDockControlBindings';
import { usePlayerDockLabels } from '../composables/usePlayerDockLabels';
import { usePlayerDockCover } from '../composables/usePlayerDockCover';
import { usePlayerDockLifecycle } from '../composables/usePlayerDockLifecycle';
import { usePlayerDockProgress } from '../composables/usePlayerDockProgress';
import { usePlayerDockRuntime } from '../composables/usePlayerDockRuntime';
import { usePlayerDockTransportRequests } from '../composables/usePlayerDockTransportRequests';
import { useQueuePopover } from '../composables/useQueuePopover';
import { useSleepTimer } from '../composables/useSleepTimer';
import type { PlayerDockEmits, PlayerDockProps } from '../types/playerDock';
import type { PlayerDockController } from '../types/playerDockController';
import NowPlayingInfo from './player-dock/NowPlayingInfo.vue';
import PlaybackErrorToast from './player-dock/PlaybackErrorToast.vue';
import PlaybackMetaControls from './player-dock/PlaybackMetaControls.vue';
import PlaybackProgressBar from './player-dock/PlaybackProgressBar.vue';
import TransportControls from './player-dock/TransportControls.vue';

const props = defineProps<PlayerDockProps>();

const emit = defineEmits<PlayerDockEmits>();

const player = usePlayerStore();
const isPlaying = ref(false);
const rustBackendActive = ref(false);
const playbackRate = ref(1);

const {
  clearPlaybackError,
  playbackErrorMessage,
  showOutputDeviceFallbackNotice,
  showPlaybackError,
  showPlaybackNotice,
} = usePlaybackNotifications({
  getLocale: () => player.settings.locale,
  onPlaybackError: (message) => emit('playbackError', message),
});

const {
  isQueueOpen,
  locateQueueTrack,
  playQueueTrack,
  setQueueControlElement,
  setQueueTrackElement,
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
  startSleepTimer,
  syncSleepTimerSetting,
} = useSleepTimer({
  player,
});

const {
  currentTime,
  progress,
  runtimeDuration,
  totalDuration,
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
  changePlaybackRate,
  changeVolume,
  isMuted,
  queueTracks,
  toggleMute,
  togglePlayback,
  volume,
} = usePlayerDockRuntime({
  activeTrack: computed(() => props.activeTrack),
  canControlPlayback: computed(() => props.canControlPlayback),
  isPlaying,
  isPreparingActiveTrack: computed(() => props.isPreparingActiveTrack),
  playbackRate,
  progress: {
    runtimeDuration,
    setPlaybackTime,
    startSmoothProgress,
    stopSmoothProgress,
    syncPlaybackTimeFromRust,
    syncSmoothProgressBase,
  },
  queue: computed(() => props.queue),
  restoreRequestId: computed(() => props.restoreRequestId),
  restoreTime: computed(() => props.restoreTime),
  rustBackendActive,
  togglePlaybackRequestId: computed(() => props.togglePlaybackRequestId),
  onClearPlaybackError: clearPlaybackError,
  onOutputDeviceFallback: showOutputDeviceFallbackNotice,
  onPlaybackError: showPlaybackError,
  onPlaybackNotice: (message) => showPlaybackNotice(`播放失败：${message}`),
  onPlaybackStateChange: (playing) => emit('playbackStateChange', playing),
  onRequestInitialPlayback: (startTime) => emit('requestInitialPlayback', startTime),
  onSeamlessAdvance: (track) => emit('seamlessAdvance', track),
});

const {
  coverUrl,
  dockStyle,
  handleCoverError,
  hasThemeBackground,
} = usePlayerDockCover({
  activeTrack: computed(() => props.activeTrack),
});

const {
  lyricFormatLabel,
  onlineQualityLabel,
  playbackLabel,
  playbackRateLabel,
} = usePlayerDockLabels({
  locale: () => player.settings.locale,
  lyricFormat: () => props.lyricFormat,
  lyricFormats: () => props.lyricFormats,
  onlineQuality: () => props.onlineQuality,
  onlineQualityOptions: () => props.onlineQualityOptions,
  playbackRate,
});

const {
  requestFavoriteToggle,
  requestNextTrack,
  requestPlaybackModeToggle,
  requestPreviousTrack,
} = usePlayerDockTransportRequests({
  onNext: () => emit('playNext'),
  onPrevious: () => emit('playPrevious'),
  onToggleFavorite: () => emit('toggleFavorite'),
  onTogglePlaybackMode: () => emit('togglePlaybackMode'),
});

useInAppShortcuts({
  bindings: computed(() => player.settings.appShortcuts),
  enabled: computed(() => player.settings.enableAppShortcuts),
  actions: {
    nextTrack: requestNextTrack,
    previousTrack: requestPreviousTrack,
    toggleDesktopLyrics: () => emit('toggleDesktopLyrics'),
    toggleFavorite: requestFavoriteToggle,
    togglePlayback,
    togglePlaybackMode: requestPlaybackModeToggle,
    volumeDown: () => changeVolume(Math.max(0, volume.value - 5)),
    volumeUp: () => changeVolume(Math.min(100, volume.value + 5)),
  },
});

usePlayerDockLifecycle({
  getSeekRequestId: () => props.seekRequestId,
  getSeekTime: () => props.seekTime,
  getSleepTimerMinutesSetting: () => player.settings.sleepTimerMinutes,
  seekPlaybackTo,
  syncSleepTimerSetting,
});

const {
  nowPlayingInfoProps,
  playbackMetaControlProps,
  transportControlProps,
} = usePlayerDockControlBindings({
  meta: {
    activeTrack: () => props.activeTrack,
    isActiveTrackDownloaded: () => props.isActiveTrackDownloaded,
    isActiveTrackDownloading: () => props.isActiveTrackDownloading,
    isMuted: () => isMuted.value,
    isPlaying: () => isPlaying.value,
    isPreparingActiveTrack: () => props.isPreparingActiveTrack,
    isQueueOpen: () => isQueueOpen.value,
    locale: () => player.settings.locale,
    lyricFormat: () => props.lyricFormat,
    lyricFormatLabel: () => lyricFormatLabel.value,
    lyricFormats: () => props.lyricFormats,
    onlineQuality: () => props.onlineQuality,
    onlineQualityLabel: () => onlineQualityLabel.value,
    onlineQualityOptions: () => props.onlineQualityOptions,
    playbackRate: () => playbackRate.value,
    playbackRateLabel: () => playbackRateLabel.value,
    queueTracks: () => queueTracks.value,
    showActiveTrackDownload: () => props.showActiveTrackDownload,
    showLyricFormat: () => props.showLyricFormat,
    showOnlineQuality: () => props.showOnlineQuality,
    showTrackCovers: () => player.settings.showTrackCovers,
    showTrackNumbers: () => player.settings.showTrackNumbers,
    sleepTimerAction: () => player.settings.sleepTimerAction,
    sleepTimerExecuteAtLabel: () => sleepTimerExecuteAtLabel.value,
    sleepTimerHours: () => sleepTimerHours.value,
    isSleepTimerActive: () => isSleepTimerActive.value,
    isSleepTimerDialogOpen: () => isSleepTimerDialogOpen.value,
    isSleepTimerPaused: () => isSleepTimerPaused.value,
    isSleepTimerStatusOpen: () => isSleepTimerStatusOpen.value,
    sleepTimerMinutes: () => sleepTimerMinutes.value,
    sleepTimerPresetMinutes: () => sleepTimerPresetMinutes,
    sleepTimerProgressPercent: () => sleepTimerProgressPercent.value,
    sleepTimerRemainingLabel: () => sleepTimerRemainingLabel.value,
    volume: () => volume.value,
  },
  nowPlaying: {
    activeTrack: () => props.activeTrack,
    coverUrl: () => coverUrl.value,
    currentTime: () => currentTime.value,
    locale: () => player.settings.locale,
    lyricsOpen: () => props.lyricsOpen,
    totalDurationLabel: () => totalDurationLabel.value,
  },
  transport: {
    activeTrack: () => props.activeTrack,
    isFavorite: () => props.isFavorite,
    isPlaying: () => isPlaying.value,
    locale: () => player.settings.locale,
    playbackMode: () => props.playbackMode,
    playbackModeLabel: () => props.playbackModeLabel,
  },
});

const playerDockController: PlayerDockController = {
  playbackMetaControlProps,
  transportControlProps,
  progress,
  totalDuration,
  togglePlayback,
  requestNextTrack,
  requestPreviousTrack,
  requestFavoriteToggle,
  requestPlaybackModeToggle,
  previewSeekAudio,
  commitSeekAudio,
  changeVolume,
  toggleMute,
  changePlaybackRate,
  clearSleepTimer,
  closeSleepTimerDialog,
  closeSleepTimerStatus,
  downloadActiveTrack: () => emit('downloadActiveTrack'),
  locateQueueTrack,
  changeLyricFormat: (format) => emit('lyricFormatChange', format),
  changeOnlineQuality: (quality) => emit('onlineQualityChange', quality),
  openDesktopLyrics: () => emit('openDesktopLyrics'),
  pauseSleepTimer,
  playQueueTrack,
  resumeSleepTimer,
  setQueueControlElement,
  setQueueTrackElement,
  setSleepTimerAction: (action) => player.setSleepTimerAction(action),
  setSleepTimerHours: (value) => { sleepTimerHours.value = value; },
  setSleepTimerMinutes: (value) => { sleepTimerMinutes.value = value; },
  setSleepTimerPreset,
  startSleepTimer,
  toggleQueuePanel,
  toggleSleepTimer: handleSleepTimerButtonClick,
};

defineExpose({ getController: () => playerDockController });
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
      :duration="totalDuration"
      :label="playbackLabel"
      :value="progress"
      @input="previewSeekAudio"
      @change="commitSeekAudio"
    />

    <PlaybackErrorToast :message="playbackErrorMessage" @close="clearPlaybackError" />

    <NowPlayingInfo
      v-bind="nowPlayingInfoProps"
      @cover-error="handleCoverError"
      @open-lyrics="emit('openLyrics')"
    />

    <TransportControls
      v-bind="transportControlProps"
      @next="requestNextTrack"
      @previous="requestPreviousTrack"
      @toggle-favorite="requestFavoriteToggle"
      @toggle-playback="togglePlayback"
      @toggle-playback-mode="requestPlaybackModeToggle"
    />

    <PlaybackMetaControls
      v-bind="playbackMetaControlProps"
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
  padding: 10px var(--player-dock-padding-x);
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

