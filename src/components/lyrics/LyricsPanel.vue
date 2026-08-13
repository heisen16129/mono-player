<script setup lang="ts">
import { ref } from 'vue';
import type { LyricLine } from '../../types/music';
import LyricsLine from './LyricsLine.vue';
import LyricsPanelScrollbar from './LyricsPanelScrollbar.vue';
import LyricsPanelState from './LyricsPanelState.vue';
import LyricsSyncControls from './LyricsSyncControls.vue';

defineProps<{
  activeLyricIndex: number;
  emptyMessage: string;
  isEmpty: boolean;
  isPlayerDockHidden: boolean;
  isLyricsPending: boolean;
  isLyricSyncOpen: boolean;
  isScrolling: boolean;
  label: string;
  lines: LyricLine[];
  loadingText: string;
  lyricWordProgress: (line: LyricLine, lineIndex: number, wordIndex: number) => string;
  scrollThumbTop: number;
}>();

const emit = defineEmits<{
  beginBrowse: [];
  hideScrollbar: [];
  openSearch: [];
  restoreRealtime: [];
  scroll: [];
  seek: [line: LyricLine];
  shiftTiming: [deltaSeconds: number];
  wheel: [];
}>();

const panel = ref<HTMLElement | null>(null);

defineExpose({ panel });
</script>

<template>
  <div class="lyrics-panel-wrap" :class="{ 'is-dock-hidden': isPlayerDockHidden, 'is-scrolling': isScrolling }">
    <div
      ref="panel"
      class="lyrics-panel"
      :class="{ 'is-empty': isEmpty }"
      :aria-label="label"
      @pointerdown="emit('beginBrowse')"
      @pointerup="emit('restoreRealtime')"
      @pointercancel="emit('restoreRealtime')"
      @mouseleave="emit('restoreRealtime'); emit('hideScrollbar')"
      @scroll="emit('scroll')"
      @wheel.passive="emit('wheel')"
    >
      <LyricsPanelState
        :empty-message="emptyMessage"
        :is-lyrics-pending="isLyricsPending"
        :lines-count="lines.length"
        :loading-text="loadingText"
        @open-search="emit('openSearch')"
      />
      <LyricsLine
        v-for="(line, index) in lines"
        :key="`${line.time ?? 'plain'}-${line.text}-${index}`"
        :active-lyric-index="activeLyricIndex"
        :line="line"
        :line-index="index"
        :lyric-word-progress="lyricWordProgress"
        @seek="emit('seek', $event)"
      />
    </div>
    <LyricsPanelScrollbar v-if="lines.length" :top="scrollThumbTop" :visible="isScrolling" />
    <LyricsSyncControls v-if="isLyricSyncOpen" @shift-timing="emit('shiftTiming', $event)" />
  </div>
</template>

<style scoped>
.lyrics-panel-wrap {
  position: relative;
  align-self: stretch;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.lyrics-panel {
  display: grid;
  gap: 20px;
  justify-items: center;
  height: 100%;
  min-height: 420px;
  overflow-y: auto;
  padding: var(--lyrics-anchor-padding-top, 32%) 24px var(--lyrics-anchor-padding-bottom, 42%) 24px;
  color: var(--smw-text-secondary);
  text-align: center;
  scrollbar-width: none;
}

.lyrics-panel::-webkit-scrollbar {
  display: none;
}

.lyrics-panel.is-empty {
  align-content: center;
  padding: 0 24px;
}

</style>
