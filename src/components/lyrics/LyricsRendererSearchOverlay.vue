<script setup lang="ts">
import type { LyricsRendererSearchDialogContext } from '../../types/lyricsRenderer';
import LyricsSearchDialogOverlay from './LyricsSearchDialogOverlay.vue';

const props = defineProps<{
  context: LyricsRendererSearchDialogContext;
}>();
</script>

<template>
  <LyricsSearchDialogOverlay
    :is-loading-more="props.context.isLoadingMore"
    :is-open="props.context.isOpen"
    :is-searching="props.context.isSearching"
    :provider-id="props.context.providerId"
    :providers="props.context.providers"
    :query="props.context.query"
    :resolving-track-key="props.context.resolvingTrackKey"
    :results="props.context.results"
    :status="props.context.status"
    :tab-items="props.context.tabItems"
    :track-key="props.context.trackKey"
    @apply="props.context.apply"
    @close="props.context.close"
    @scroll="props.context.scroll"
    @search="props.context.search"
    @select-provider="props.context.selectProvider"
    @update:query="props.context.updateQuery"
  />
</template>
