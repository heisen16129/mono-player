<script setup lang="ts">
import type { PluginSearchTrack } from '../../types/plugin';
import LyricsSearchResultRow from './LyricsSearchResultRow.vue';

defineProps<{
  isLoadingMore: boolean;
  isSearching: boolean;
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  status: string;
  trackKey: (track: PluginSearchTrack) => string;
}>();

const emit = defineEmits<{
  apply: [track: PluginSearchTrack];
  scroll: [event: Event];
}>();
</script>

<template>
  <div class="lyrics-search-results" @scroll="emit('scroll', $event)">
    <p v-if="isSearching" class="lyrics-search-state">正在搜索歌词...</p>
    <template v-else>
      <LyricsSearchResultRow
        v-for="track in results"
        :key="trackKey(track)"
        :is-resolving="resolvingTrackKey === trackKey(track)"
        :track="track"
        @apply="emit('apply', $event)"
      />
      <p v-if="isLoadingMore" class="lyrics-search-state">正在加载更多...</p>
    </template>
    <p v-if="!isSearching && status" class="lyrics-search-state">{{ status }}</p>
  </div>
</template>

<style scoped>
.lyrics-search-results {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 12px 12px;
}

.lyrics-search-state {
  margin: 18px 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
  text-align: center;
}
</style>
