<script setup lang="ts">
import type { PluginSearchTrack } from '../../types/plugin';
import LyricsSearchResultCover from './LyricsSearchResultCover.vue';
import LyricsSearchResultMeta from './LyricsSearchResultMeta.vue';

defineProps<{
  isResolving: boolean;
  track: PluginSearchTrack;
}>();

const emit = defineEmits<{
  apply: [track: PluginSearchTrack];
}>();
</script>

<template>
  <button
    class="lyrics-search-row"
    type="button"
    :disabled="isResolving"
    @click="emit('apply', track)"
  >
    <LyricsSearchResultCover :artwork="track.artwork" />
    <LyricsSearchResultMeta :artist="track.artist" :provider-name="track.providerName" :title="track.title" />
    <small v-if="isResolving" class="lyrics-search-resolving">读取中</small>
  </button>
</template>

<style scoped>
.lyrics-search-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.lyrics-search-row:hover,
.lyrics-search-row:focus-visible {
  background: var(--smw-bg-hover);
  outline: none;
}

.lyrics-search-row:disabled {
  cursor: wait;
  opacity: 0.72;
}

.lyrics-search-resolving {
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
