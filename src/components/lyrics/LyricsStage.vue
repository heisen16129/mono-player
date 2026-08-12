<script setup lang="ts">
import { ref } from 'vue';
import type { LyricLine } from '../../types/music';
import LyricsCoverPanel from './LyricsCoverPanel.vue';
import LyricsPanel from './LyricsPanel.vue';

defineProps<{
  activeLyricIndex: number;
  coverUrl: string;
  emptyMessage: string;
  isEmpty: boolean;
  isPlayerDockHidden: boolean;
  isLyricSyncOpen: boolean;
  isLyricsPending: boolean;
  isScrolling: boolean;
  label: string;
  lines: LyricLine[];
  loadingText: string;
  lyricWordProgress: (line: LyricLine, lineIndex: number, wordIndex: number) => string;
  scrollThumbTop: number;
  setLyricsPanelRef: (instance: unknown) => void;
}>();

defineEmits<{
  beginBrowse: [];
  coverError: [];
  hideScrollbar: [];
  openSearch: [];
  restoreRealtime: [];
  scroll: [];
  seek: [line: LyricLine];
  shiftTiming: [deltaSeconds: number];
  wheel: [];
}>();

const stage = ref<HTMLElement | null>(null);

function lyricsAnchorOffset() {
  const cover = stage.value?.querySelector<HTMLElement>('.lyrics-stage-cover') ?? null;
  const panel = stage.value?.querySelector<HTMLElement>('.lyrics-panel') ?? null;
  if (!cover || !panel) return null;

  const coverRect = cover.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  return coverRect.top + coverRect.height / 2 - panelRect.top;
}

defineExpose({ lyricsAnchorOffset });
</script>

<template>
  <div ref="stage" class="lyrics-stage">
    <LyricsCoverPanel class="lyrics-stage-cover" :cover-url="coverUrl" @error="$emit('coverError')" />

    <LyricsPanel
      :ref="setLyricsPanelRef"
      class="lyrics-stage-panel"
      :active-lyric-index="activeLyricIndex"
      :empty-message="emptyMessage"
      :is-empty="isEmpty"
      :is-player-dock-hidden="isPlayerDockHidden"
      :is-lyric-sync-open="isLyricSyncOpen"
      :is-lyrics-pending="isLyricsPending"
      :is-scrolling="isScrolling"
      :label="label"
      :lines="lines"
      :loading-text="loadingText"
      :lyric-word-progress="lyricWordProgress"
      :scroll-thumb-top="scrollThumbTop"
      @begin-browse="$emit('beginBrowse')"
      @hide-scrollbar="$emit('hideScrollbar')"
      @open-search="$emit('openSearch')"
      @restore-realtime="$emit('restoreRealtime')"
      @scroll="$emit('scroll')"
      @seek="$emit('seek', $event)"
      @shift-timing="$emit('shiftTiming', $event)"
      @wheel="$emit('wheel')"
    />
  </div>
</template>

<style scoped>
.lyrics-stage {
  display: grid;
  grid-template-columns: minmax(240px, 360px) minmax(520px, 1.7fr);
  grid-template-rows: minmax(0, 1fr) var(--player-height);
  gap: clamp(44px, 6vw, 86px);
  align-items: center;
  max-width: 1280px;
  height: calc(100% - 78px);
  margin: 0 auto;
}

.lyrics-stage-cover {
  grid-row: 1;
}

.lyrics-stage-panel {
  grid-row: 1 / 3;
}
</style>
