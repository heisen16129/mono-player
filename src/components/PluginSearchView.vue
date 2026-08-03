<script setup lang="ts">
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import type { PluginSearchViewProps } from '../types/discoverMusicPage';
import PluginSearchResultsList from './plugin-search/PluginSearchResultsList.vue';
import PluginSearchToolbar from './plugin-search/PluginSearchToolbar.vue';

defineProps<PluginSearchViewProps>();

const emit = defineEmits<{
  retry: [];
  backLocal: [];
  downloadTrack: [track: PluginSearchTrack];
  loadMore: [];
  retryLoadMore: [];
  openTrackMenu: [track: PluginSearchTrack, x: number, y: number];
  search: [keyword: string];
  selectProvider: [providerId: string];
  toggleFavorite: [track: Track];
  playTrack: [track: PluginSearchTrack];
}>();

</script>

<template>
  <section class="plugin-search-view">
    <PluginSearchToolbar
      :active-provider-id="activeProviderId"
      :loading="loading"
      :providers="providers"
      :query="query"
      @search="emit('search', $event)"
      @select-provider="emit('selectProvider', $event)"
    />

    <PluginSearchResultsList
      :active-playback-track="activePlaybackTrack"
      :active-track-key="activeTrackKey"
      :downloaded-track-keys="downloadedTrackKeys"
      :error="error"
      :favorite-track-ids="favoriteTrackIds"
      :has-more="hasMore"
      :is-playing="isPlaying"
      :load-more-error="loadMoreError"
      :loading="loading"
      :loading-more="loadingMore"
      :pending-download-track-keys="pendingDownloadTrackKeys"
      :resolving-track-key="resolvingTrackKey"
      :results="results"
      :spectrum-levels="spectrumLevels"
      @download-track="emit('downloadTrack', $event)"
      @load-more="emit('loadMore')"
      @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
      @play-track="emit('playTrack', $event)"
      @retry="emit('retry')"
      @retry-load-more="emit('retryLoadMore')"
      @toggle-favorite="emit('toggleFavorite', $event)"
    />
  </section>
</template>

<style scoped>
.plugin-search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 22px 28px 24px;
  background: var(--smw-bg-workspace);
}

</style>
