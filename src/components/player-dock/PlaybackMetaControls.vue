<script setup lang="ts">
import type { Locale, PlayerSettings, Track } from '../../types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../../types/plugin';
import { t } from '../../i18n';
import DesktopLyricsEntryButton from './DesktopLyricsEntryButton.vue';
import DockDownloadButton from './DockDownloadButton.vue';
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
    <DockDownloadButton
      v-if="showActiveTrackDownload"
      :is-downloaded="isActiveTrackDownloaded"
      :is-downloading="isActiveTrackDownloading"
      @download="emit('downloadActiveTrack')"
    />
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
    <DesktopLyricsEntryButton @open="emit('openDesktopLyrics')" />
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
  gap: 8px;
  align-items: center;
  justify-content: end;
  color: var(--smw-text-body);
  font-size: 12px;
}

.playback-meta :deep(.icon-button) {
  box-sizing: border-box;
  flex: 0 0 28px;
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  color: var(--smw-text-body);
  line-height: 0;
}

.playback-meta :deep(svg) {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
</style>
