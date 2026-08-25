<script setup lang="ts">
import { ref } from 'vue';
import type { LyricsRendererContext } from '../../../types/lyricsRenderer';
import type { PlayerDockController } from '../../../types/playerDockController';
import LyricsStage from '../LyricsStage.vue';
import LyricsRendererSurface from '../LyricsRendererSurface.vue';

const props = defineProps<{
  context: LyricsRendererContext;
  playerDockController?: PlayerDockController | null;
}>();

const stageRef = ref<{ lyricsAnchorOffset?: () => number | null } | null>(null);

function lyricsAnchorOffset() {
  return stageRef.value?.lyricsAnchorOffset?.() ?? null;
}

defineExpose({ lyricsAnchorOffset });
</script>

<template>
  <LyricsRendererSurface
    :context="props.context"
    :player-dock-controller="props.playerDockController"
    @close="props.context.close"
  >
    <LyricsStage
      ref="stageRef"
      :active-lyric-index="props.context.activeLyricIndex"
      :cover-url="props.context.coverUrl ?? ''"
      :empty-message="props.context.emptyMessage"
      :is-empty="!props.context.lines.length"
      :is-player-dock-hidden="props.context.isPlayerDockHidden"
      :is-lyric-sync-open="props.context.isLyricSyncOpen"
      :is-lyrics-pending="props.context.isLoading && !props.context.lines.length"
      :is-scrolling="props.context.isScrolling"
      :label="props.context.label"
      :lines="props.context.lines"
      :loading-text="props.context.loadingText"
      :lyric-word-progress="props.context.lyricWordProgress"
      :scroll-thumb-top="props.context.scrollThumbTop"
      :set-lyrics-panel-ref="props.context.setLyricsPanelRef"
      @begin-browse="props.context.beginBrowse"
      @cover-error="props.context.coverError"
      @hide-scrollbar="props.context.hideScrollbar"
      @open-search="props.context.openSearch"
      @restore-realtime="props.context.restoreRealtime"
      @scroll="props.context.syncScroll"
      @seek="props.context.seek"
      @shift-timing="props.context.shiftTiming"
      @wheel="props.context.handleWheel"
    />
  </LyricsRendererSurface>
</template>
