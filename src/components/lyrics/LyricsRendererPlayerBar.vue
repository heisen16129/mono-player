<script setup lang="ts">
import { computed } from 'vue';
import { ChevronsDown, Heart, Pause, Play, SkipBack, SkipForward, Volume2 } from '@lucide/vue';
import type { LyricsRendererContext } from '../../types/lyricsRenderer';
import type { PlayerDockController } from '../../types/playerDockController';
import PlaybackMetaControls from '../player-dock/PlaybackMetaControls.vue';
import PlaybackProgressBar from '../player-dock/PlaybackProgressBar.vue';
import TransportControls from '../player-dock/TransportControls.vue';

const props = defineProps<{
  context: LyricsRendererContext;
  controller?: PlayerDockController | null;
  showProgress?: boolean;
}>();

const dockTransportProps = computed(() => props.controller?.transportControlProps.value ?? null);
const dockMetaProps = computed(() => props.controller?.playbackMetaControlProps.value ?? null);
const dockProgress = computed(() => props.controller?.progress.value ?? 0);
const dockDuration = computed(() => props.controller?.totalDuration.value ?? 0);

function formatTime(value: number | null) {
  if (!Number.isFinite(value)) return '--:--';
  const total = Math.max(0, Math.round(value as number));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function updateTime(event: Event) {
  props.context.seekToTime(Number((event.target as HTMLInputElement).value));
}

function updateVolume(event: Event) {
  props.context.setVolume(Number((event.target as HTMLInputElement).value));
}

function togglePlayback() {
  props.controller?.togglePlayback();
  if (!props.controller) props.context.togglePlayback();
}

function playPrevious() {
  props.controller?.requestPreviousTrack();
  if (!props.controller) props.context.playPrevious();
}

function playNext() {
  props.controller?.requestNextTrack();
  if (!props.controller) props.context.playNext();
}

function toggleFavorite() {
  props.controller?.requestFavoriteToggle();
  if (!props.controller) props.context.toggleFavorite();
}
</script>

<template>
  <footer class="lyrics-renderer-player-bar">
    <PlaybackProgressBar
      v-if="props.showProgress !== false && props.controller"
      :duration="dockDuration"
      :label="props.context.label"
      :value="dockProgress"
      @input="props.controller.previewSeekAudio"
      @change="props.controller.commitSeekAudio"
    />
    <input
      v-else-if="props.showProgress !== false"
      class="lyrics-renderer-progress"
      type="range"
      min="0"
      :max="Math.max(0, props.context.duration ?? 0)"
      step="0.1"
      :value="Math.min(Math.max(0, props.context.currentTime), props.context.duration ?? 0)"
      aria-label="播放进度"
      @input="updateTime"
    />

    <div class="lyrics-renderer-now-playing">
      <button class="lyrics-renderer-cover-button" type="button" aria-label="收起歌词页" @click="props.context.close">
        <ChevronsDown class="lyrics-renderer-cover-collapse-icon" :size="24" />
      </button>
      <div class="lyrics-renderer-track-info" aria-hidden="true">
        <span></span>
        <span></span>
      </div>
      <span class="lyrics-renderer-time-pair">
        <span>{{ formatTime(props.context.currentTime) }}</span>
        <span>/</span>
        <span>{{ formatTime(props.context.duration) }}</span>
      </span>
    </div>

    <TransportControls
      v-if="dockTransportProps && props.controller"
      v-bind="dockTransportProps"
      @next="props.controller.requestNextTrack"
      @previous="props.controller.requestPreviousTrack"
      @toggle-favorite="props.controller.requestFavoriteToggle"
      @toggle-playback="props.controller.togglePlayback"
      @toggle-playback-mode="props.controller.requestPlaybackModeToggle"
    />
    <div v-else class="lyrics-renderer-transport">
      <button type="button" aria-label="收藏" :class="{ active: props.context.isFavorite }" @click="toggleFavorite">
        <Heart :size="18" :fill="props.context.isFavorite ? 'currentColor' : 'none'" />
      </button>
      <button type="button" aria-label="上一曲" @click="playPrevious"><SkipBack :size="20" /></button>
      <button class="lyrics-renderer-play" type="button" aria-label="播放或暂停" @click="togglePlayback">
        <Pause v-if="props.context.isPlaying" :size="20" fill="currentColor" />
        <Play v-else :size="20" fill="currentColor" />
      </button>
      <button type="button" aria-label="下一曲" @click="playNext"><SkipForward :size="20" /></button>
    </div>

    <PlaybackMetaControls
      v-if="dockMetaProps && props.controller"
      v-bind="dockMetaProps"
      @clear-sleep-timer="props.controller.clearSleepTimer"
      @close-sleep-timer-dialog="props.controller.closeSleepTimerDialog"
      @close-sleep-timer-status="props.controller.closeSleepTimerStatus"
      @download-active-track="props.controller.downloadActiveTrack"
      @locate-queue-track="props.controller.locateQueueTrack"
      @lyric-format-change="props.controller.changeLyricFormat"
      @online-quality-change="props.controller.changeOnlineQuality"
      @open-desktop-lyrics="props.controller.openDesktopLyrics"
      @pause-sleep-timer="props.controller.pauseSleepTimer"
      @play-queue-track="props.controller.playQueueTrack"
      @resume-sleep-timer="props.controller.resumeSleepTimer"
      @set-queue-control="props.controller.setQueueControlElement"
      @set-queue-track-ref="props.controller.setQueueTrackElement"
      @set-sleep-timer-action="props.controller.setSleepTimerAction"
      @set-sleep-timer-hours="props.controller.setSleepTimerHours"
      @set-sleep-timer-minutes="props.controller.setSleepTimerMinutes"
      @set-sleep-timer-preset="props.controller.setSleepTimerPreset"
      @start-sleep-timer="props.controller.startSleepTimer"
      @toggle-mute="props.controller.toggleMute"
      @toggle-queue-panel="props.controller.toggleQueuePanel"
      @toggle-sleep-timer="props.controller.toggleSleepTimer"
      @update-playback-rate="props.controller.changePlaybackRate"
      @update-volume="props.controller.changeVolume"
    />
    <label v-else class="lyrics-renderer-volume" aria-label="音量">
      <Volume2 :size="17" />
      <input type="range" min="0" max="100" step="1" :value="props.context.volume" @input="updateVolume" />
    </label>
  </footer>
</template>

<style scoped>
.lyrics-renderer-player-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(240px, 390px) minmax(340px, 1.35fr);
  gap: 14px;
  align-items: center;
  min-height: var(--player-height);
  padding: 14px var(--player-dock-padding-x);
  isolation: isolate;
  color: var(--smw-text-primary);
  border-top: 1px solid transparent;
  background: transparent;
}

.lyrics-renderer-now-playing {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.lyrics-renderer-cover-button {
  position: relative;
  display: grid;
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  place-items: center;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-primary);
  background: transparent;
  cursor: pointer;
}

.lyrics-renderer-cover-collapse-icon {
  opacity: 0;
  transform: translateY(-8px) rotateX(52deg);
  transform-origin: 50% 50%;
  transition:
    opacity 160ms ease,
    transform 240ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-style: preserve-3d;
}

.lyrics-renderer-cover-button:hover .lyrics-renderer-cover-collapse-icon,
.lyrics-renderer-cover-button:focus-visible .lyrics-renderer-cover-collapse-icon {
  opacity: 1;
  transform: translateY(0) rotateX(0deg);
}

.lyrics-renderer-track-info {
  display: grid;
  height: 52px;
  box-sizing: border-box;
  align-content: space-between;
  min-width: 0;
  gap: 0;
  padding: 5px 0;
}

.lyrics-renderer-track-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-renderer-time-pair {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 2px;
  margin-left: 0;
  color: var(--smw-text-secondary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

.lyrics-renderer-time-pair span:first-child {
  font-weight: 500;
}

.lyrics-renderer-track-info span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.lyrics-renderer-progress {
  position: absolute;
  z-index: 2;
  top: 0;
  right: var(--player-dock-padding-x);
  left: var(--player-dock-padding-x);
  width: calc(100% - 2 * var(--player-dock-padding-x));
  height: 3px;
  accent-color: var(--smw-accent, var(--smw-accent-blue, #4a90e2));
}

.lyrics-renderer-transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.lyrics-renderer-player-bar .lyrics-renderer-transport button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--smw-text-secondary);
  background: transparent;
  cursor: pointer;
}

.lyrics-renderer-player-bar .lyrics-renderer-transport button:hover,
.lyrics-renderer-player-bar .lyrics-renderer-transport button.active {
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-text-primary) 8%, transparent);
}

.lyrics-renderer-player-bar .lyrics-renderer-transport .lyrics-renderer-play {
  width: 44px;
  height: 44px;
  color: var(--smw-accent-contrast, #fff);
  background: var(--smw-accent, var(--smw-accent-blue, #4a90e2));
}

.lyrics-renderer-volume {
  display: flex;
  align-items: center;
  justify-content: end;
  justify-self: end;
  gap: 8px;
  color: var(--smw-text-secondary);
}

.lyrics-renderer-volume input {
  width: 96px;
  accent-color: var(--smw-accent, var(--smw-accent-blue, #4a90e2));
}

@media (max-width: 1100px) {
  .lyrics-renderer-player-bar {
    grid-template-columns: minmax(220px, 1fr) 240px minmax(220px, 1fr);
  }
}

@media (max-width: 820px) {
  .lyrics-renderer-player-bar {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .lyrics-renderer-now-playing {
  }

  .lyrics-renderer-transport {
    grid-column: auto;
    position: static;
    transform: none;
  }

  :deep(.transport),
  :deep(.playback-meta) {
    position: static;
    grid-column: auto;
    transform: none;
  }

  .lyrics-renderer-volume {
    grid-column: auto;
  }
}
</style>
