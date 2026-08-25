<script setup lang="ts">
import { computed, ref } from 'vue';
import LyricsHeaderBar from './LyricsHeaderBar.vue';
import LyricsActionMenuOverlay from './LyricsActionMenuOverlay.vue';
import LyricsRendererPlayerBar from './LyricsRendererPlayerBar.vue';
import LyricsRendererSearchOverlay from './LyricsRendererSearchOverlay.vue';
import PlaybackProgressBar from '../player-dock/PlaybackProgressBar.vue';
import type { LyricsRendererContext } from '../../types/lyricsRenderer';
import type { PlayerDockController } from '../../types/playerDockController';

const props = defineProps<{
  context: LyricsRendererContext;
  playerDockController?: PlayerDockController | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const isPlayerBarHidden = ref(false);
const dockProgress = computed(() => props.playerDockController?.progress.value ?? 0);
const dockDuration = computed(() => props.playerDockController?.totalDuration.value ?? 0);
const actionMenu = computed(() => ({
  ...props.context.actionMenu,
  isPlayerDockHidden: isPlayerBarHidden.value,
  togglePlayerDock: () => {
    isPlayerBarHidden.value = !isPlayerBarHidden.value;
    props.context.actionMenu.close();
  },
}));

function updateCollapsedTime(event: Event) {
  props.context.seekToTime(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div
    class="lyrics-renderer-surface"
    :class="{ 'has-cover-background': props.context.coverUrl }"
    @contextmenu.prevent="props.context.openActionMenu"
  >
    <div class="lyrics-renderer-header">
      <LyricsHeaderBar
        :album="props.context.album"
        :artist="props.context.artist"
        :close-label="props.context.label"
        :title="props.context.title"
        @close="emit('close')"
      />
    </div>

    <div class="lyrics-renderer-content">
      <slot />
    </div>

    <Transition name="lyrics-player-bar">
      <LyricsRendererPlayerBar
        v-if="!isPlayerBarHidden"
        :context="props.context"
        :controller="props.playerDockController"
        :show-progress="!isPlayerBarHidden"
      />
    </Transition>

    <PlaybackProgressBar
      v-if="isPlayerBarHidden && props.playerDockController"
      class="lyrics-renderer-collapsed-progress"
      :duration="dockDuration"
      :label="props.context.label"
      :value="dockProgress"
      @input="props.playerDockController.previewSeekAudio"
      @change="props.playerDockController.commitSeekAudio"
    />
    <input
      v-else-if="isPlayerBarHidden"
      class="lyrics-renderer-collapsed-progress-input"
      type="range"
      min="0"
      :max="Math.max(0, props.context.duration ?? 0)"
      step="0.1"
      :value="Math.min(Math.max(0, props.context.currentTime), props.context.duration ?? 0)"
      :aria-label="props.context.label"
      @input="updateCollapsedTime"
    />

    <LyricsActionMenuOverlay
      v-bind="actionMenu"
      @clear-associated-lyrics="props.context.actionMenu.clearAssociatedLyrics"
      @close-lyric-sync="props.context.actionMenu.closeLyricSync"
      @decrease-font-size="props.context.actionMenu.decreaseFontSize"
      @download-cover="props.context.actionMenu.downloadCover"
      @download-lyrics="props.context.actionMenu.downloadLyrics"
      @increase-font-size="props.context.actionMenu.increaseFontSize"
      @open-lyric-search="props.context.actionMenu.openLyricSearch"
      @open-lyric-sync="props.context.actionMenu.openLyricSync"
      @open-settings="props.context.actionMenu.openSettings"
      @toggle-fullscreen="props.context.actionMenu.toggleFullscreen"
      @toggle-player-dock="actionMenu.togglePlayerDock"
    />

    <LyricsRendererSearchOverlay :context="props.context.searchDialog" />
  </div>
</template>

<style scoped>
.lyrics-renderer-surface {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--smw-lyrics-bg, var(--smw-bg-canvas));
}

.lyrics-renderer-surface::before,
.lyrics-renderer-surface::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: "";
  pointer-events: none;
}

.lyrics-renderer-surface::before {
  inset: -18px;
  background-image: var(--lyrics-cover-bg);
  background-position: center;
  background-size: cover;
  filter: blur(16px) saturate(0.82) brightness(1.02);
  opacity: 0;
  transform: scale(1.02);
}

.lyrics-renderer-surface.has-cover-background::before {
  opacity: 1;
}

.lyrics-renderer-surface::after {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--smw-lyrics-bg) 82%, transparent) 0%,
      color-mix(in srgb, var(--smw-lyrics-bg) 68%, transparent) 48%,
      color-mix(in srgb, var(--smw-lyrics-bg) 88%, transparent) 100%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.54) 0%,
      color-mix(in srgb, var(--smw-lyrics-bg) 24%, transparent) 56%,
      color-mix(in srgb, var(--smw-lyrics-bg) 42%, transparent) 100%
    );
  opacity: 0;
}

.lyrics-renderer-surface.has-cover-background::after {
  opacity: 0.82;
}

.lyrics-renderer-surface > * {
  z-index: 1;
}

.lyrics-player-bar-enter-active,
.lyrics-player-bar-leave-active {
  transition:
    transform 260ms cubic-bezier(0.22, 0.76, 0.22, 1),
    opacity 180ms ease;
}

.lyrics-player-bar-enter-from,
.lyrics-player-bar-leave-to {
  opacity: 0;
  pointer-events: none;
  transform: translateY(100%);
}

.lyrics-renderer-collapsed-progress {
  top: auto;
  bottom: -7px;
}

.lyrics-renderer-collapsed-progress-input {
  position: absolute;
  right: 0;
  bottom: -7px;
  left: 0;
  z-index: 36;
  width: 100%;
  height: 14px;
  margin: 0;
  padding: 0;
  accent-color: var(--smw-progress-fill);
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-player-bar-enter-active,
  .lyrics-player-bar-leave-active {
    transition: opacity 120ms ease;
  }
}

.lyrics-renderer-content {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 18px clamp(28px, 5vw, 72px) 8px;
}

.lyrics-renderer-header {
  position: absolute;
  inset: 16px 0 auto;
  z-index: 20;
  display: grid;
  width: 100%;
  justify-items: center;
}

</style>
