<script setup lang="ts">
import { Captions, CheckCircle2, Download } from '@lucide/vue';
import type { Locale, PlayerSettings, Track } from '../../types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../../types/plugin';
import { t } from '../../i18n';
import SpinnerIcon from '../SpinnerIcon.vue';
import PlaybackOptionControls from './PlaybackOptionControls.vue';
import PlaybackQueuePopover from './PlaybackQueuePopover.vue';
import PlaybackSpeedControl from './PlaybackSpeedControl.vue';
import SleepTimerControl from './SleepTimerControl.vue';
import VolumeControl from './VolumeControl.vue';

defineProps<{
  activeTrack: Track | null;
  isActiveTrackDownloaded: boolean;
  isActiveTrackDownloading: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  isPreparingActiveTrack: boolean;
  isQueueOpen: boolean;
  locale: Locale;
  lyricFormat: string | null;
  lyricFormatLabel: string;
  lyricFormats: string[];
  onlineQuality: PluginPlaybackQuality;
  onlineQualityLabel: string;
  onlineQualityOptions: PluginPlaybackQualityOption[];
  playbackRate: number;
  playbackRateLabel: string;
  queueTracks: Track[];
  showActiveTrackDownload: boolean;
  showLyricFormat: boolean;
  showOnlineQuality: boolean;
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  sleepTimerAction: PlayerSettings['sleepTimerAction'];
  sleepTimerExecuteAtLabel: string;
  sleepTimerHours: number;
  isSleepTimerActive: boolean;
  isSleepTimerDialogOpen: boolean;
  isSleepTimerPaused: boolean;
  isSleepTimerStatusOpen: boolean;
  sleepTimerMinutes: number;
  sleepTimerPresetMinutes: readonly number[];
  sleepTimerProgressPercent: number;
  sleepTimerRemainingLabel: string;
  spectrumLevels: number[];
  volume: number;
}>();

const emit = defineEmits<{
  clearSleepTimer: [];
  closeSleepTimerDialog: [];
  closeSleepTimerStatus: [];
  downloadActiveTrack: [];
  locateQueueTrack: [];
  lyricFormatChange: [format: string];
  onlineQualityChange: [quality: PluginPlaybackQuality];
  openDesktopLyrics: [];
  pauseSleepTimer: [];
  playQueueTrack: [track: Track];
  resumeSleepTimer: [];
  setQueueControl: [element: unknown];
  setQueueTrackRef: [trackId: number, element: unknown];
  setSleepTimerAction: [action: PlayerSettings['sleepTimerAction']];
  setSleepTimerHours: [value: number];
  setSleepTimerMinutes: [value: number];
  setSleepTimerPreset: [minutes: number];
  startSleepTimer: [];
  toggleMute: [];
  toggleQueuePanel: [];
  toggleSleepTimer: [];
  updatePlaybackRate: [value: number];
  updateVolume: [value: number];
}>();
</script>

<template>
  <div class="playback-meta">
    <button
      v-if="showActiveTrackDownload"
      class="icon-button dock-download-button"
      :class="{ 'is-downloaded': isActiveTrackDownloaded, 'is-downloading': isActiveTrackDownloading }"
      type="button"
      :disabled="isActiveTrackDownloaded || isActiveTrackDownloading"
      :aria-label="isActiveTrackDownloaded ? '已下载' : isActiveTrackDownloading ? '下载中' : '下载'"
      :title="isActiveTrackDownloaded ? '已下载' : isActiveTrackDownloading ? '下载中' : '下载'"
      @click="!isActiveTrackDownloading && emit('downloadActiveTrack')"
    >
      <CheckCircle2 v-if="isActiveTrackDownloaded" :size="18" />
      <SpinnerIcon v-else-if="isActiveTrackDownloading" :size="18" />
      <Download v-else :size="18" />
    </button>
    <PlaybackOptionControls
      :lyric-format="lyricFormat"
      :lyric-format-label="lyricFormatLabel"
      :lyric-formats="lyricFormats"
      :online-quality="onlineQuality"
      :online-quality-label="onlineQualityLabel"
      :online-quality-options="onlineQualityOptions"
      :show-lyric-format="showLyricFormat"
      :show-online-quality="showOnlineQuality"
      @lyric-format-change="emit('lyricFormatChange', $event)"
      @online-quality-change="emit('onlineQualityChange', $event)"
    />
    <button
      class="icon-button"
      type="button"
      aria-label="打开桌面歌词"
      title="打开桌面歌词"
      @click="emit('openDesktopLyrics')"
    >
      <Captions class="desktop-lyrics-entry-icon" :size="19" :stroke-width="2.25" />
    </button>
    <SleepTimerControl
      :action="sleepTimerAction"
      :execute-at-label="sleepTimerExecuteAtLabel"
      :hours="sleepTimerHours"
      :is-active="isSleepTimerActive"
      :is-dialog-open="isSleepTimerDialogOpen"
      :is-paused="isSleepTimerPaused"
      :is-status-open="isSleepTimerStatusOpen"
      :minutes="sleepTimerMinutes"
      :preset-minutes="sleepTimerPresetMinutes"
      :progress-percent="sleepTimerProgressPercent"
      :remaining-label="sleepTimerRemainingLabel"
      @clear="emit('clearSleepTimer')"
      @close-dialog="emit('closeSleepTimerDialog')"
      @close-status="emit('closeSleepTimerStatus')"
      @pause="emit('pauseSleepTimer')"
      @resume="emit('resumeSleepTimer')"
      @set-action="emit('setSleepTimerAction', $event)"
      @set-hours="emit('setSleepTimerHours', $event)"
      @set-minutes="emit('setSleepTimerMinutes', $event)"
      @set-preset="emit('setSleepTimerPreset', $event)"
      @start="emit('startSleepTimer')"
      @toggle="emit('toggleSleepTimer')"
    />
    <PlaybackSpeedControl :label="playbackRateLabel" :rate="playbackRate" @change="emit('updatePlaybackRate', $event)" />
    <VolumeControl
      :is-muted="isMuted"
      :mute-label="t(locale, 'mute')"
      :restore-label="t(locale, 'restoreVolume')"
      :volume="volume"
      :volume-label="t(locale, 'volume')"
      @change="emit('updateVolume', $event)"
      @toggle-mute="emit('toggleMute')"
    />
    <PlaybackQueuePopover
      :active-track="activeTrack"
      :is-open="isQueueOpen"
      :is-playing="isPlaying"
      :is-preparing-active-track="isPreparingActiveTrack"
      :locale="locale"
      :queue-tracks="queueTracks"
      :show-track-covers="showTrackCovers"
      :show-track-numbers="showTrackNumbers"
      :spectrum-levels="spectrumLevels"
      @locate="emit('locateQueueTrack')"
      @play-track="emit('playQueueTrack', $event)"
      @set-control="emit('setQueueControl', $event)"
      @set-track-ref="(trackId, element) => emit('setQueueTrackRef', trackId, element)"
      @toggle="emit('toggleQueuePanel')"
    />
  </div>
</template>

<style scoped>
.playback-meta {
  display: flex;
  grid-column: 3;
  gap: 10px;
  align-items: center;
  justify-content: end;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.playback-meta .icon-button {
  width: 28px;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
}

.playback-meta svg {
  width: 18px;
  height: 18px;
}

.playback-meta .desktop-lyrics-entry-icon {
  width: 19px;
  height: 19px;
}

.dock-download-button.is-downloaded {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.dock-download-button.is-downloaded:hover,
.dock-download-button.is-downloaded:focus-visible {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.dock-download-button.is-downloading {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.dock-download-button.is-downloading:hover,
.dock-download-button.is-downloading:focus-visible {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.dock-download-button.is-downloading svg {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
