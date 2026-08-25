<script setup lang="ts">
import { computed } from 'vue';
import type { LyricsRendererContext } from '../../../types/lyricsRenderer';
import type { PlayerDockController } from '../../../types/playerDockController';
import LyricsPanel from '../LyricsPanel.vue';
import LyricsRendererSurface from '../LyricsRendererSurface.vue';

const props = defineProps<{
  context: LyricsRendererContext;
  playerDockController?: PlayerDockController | null;
}>();

const maxWidth = computed(() => {
  const value = Number(props.context.config.maxWidth);
  return Math.min(1200, Math.max(520, Number.isFinite(value) ? value : 760));
});

function lyricsAnchorOffset() {
  return null;
}

defineExpose({ lyricsAnchorOffset });
</script>

<template>
  <LyricsRendererSurface
    :context="props.context"
    :player-dock-controller="props.playerDockController"
    @close="props.context.close"
  >
    <div class="focus-lyrics-renderer" :style="{ '--focus-lyrics-max-width': `${maxWidth}px` }">
      <LyricsPanel
        :ref="props.context.setLyricsPanelRef"
        :active-lyric-index="props.context.activeLyricIndex"
        :empty-message="props.context.emptyMessage"
        :is-empty="!props.context.lines.length"
        :is-player-dock-hidden="props.context.isPlayerDockHidden"
        :is-lyrics-pending="props.context.isLoading && !props.context.lines.length"
        :is-lyric-sync-open="props.context.isLyricSyncOpen"
        :is-scrolling="props.context.isScrolling"
        :label="props.context.label"
        :lines="props.context.lines"
        :loading-text="props.context.loadingText"
        :lyric-word-progress="props.context.lyricWordProgress"
        :scroll-thumb-top="props.context.scrollThumbTop"
        @begin-browse="props.context.beginBrowse"
        @hide-scrollbar="props.context.hideScrollbar"
        @open-search="props.context.openSearch"
        @restore-realtime="props.context.restoreRealtime"
        @scroll="props.context.syncScroll"
        @seek="props.context.seek"
        @shift-timing="props.context.shiftTiming"
        @wheel="props.context.handleWheel"
      />
    </div>
  </LyricsRendererSurface>
</template>

<style scoped>
.focus-lyrics-renderer {
  display: grid;
  grid-row: 1;
  align-items: stretch;
  justify-items: center;
  width: 100%;
  max-width: var(--focus-lyrics-max-width);
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding-top: 48px;
}
</style>
