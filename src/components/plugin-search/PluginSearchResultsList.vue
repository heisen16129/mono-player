<script setup lang="ts">
import { useScrollingState } from '../../composables/useScrollingState';
import type { Track } from '../../types/music';
import type { PluginSearchTrack } from '../../types/plugin';
import LoadingState from '../LoadingState.vue';
import PluginSearchEmptyState from './PluginSearchEmptyState.vue';
import PluginSearchTrackResults from './PluginSearchTrackResults.vue';

const props = defineProps<{
  activePlaybackTrack: Track | null;
  activeTrackKey: string | null;
  downloadedTrackKeys: string[];
  error: string | null;
  favoriteTrackIds: number[];
  hasMore: boolean;
  isPlaying: boolean;
  loadMoreError: string | null;
  loading: boolean;
  loadingMore: boolean;
  pendingDownloadTrackKeys: string[];
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  spectrumLevels: number[];
}>();

const emit = defineEmits<{
  downloadTrack: [track: PluginSearchTrack];
  loadMore: [];
  openTrackMenu: [track: PluginSearchTrack, x: number, y: number];
  playTrack: [track: PluginSearchTrack];
  retry: [];
  retryLoadMore: [];
  toggleFavorite: [track: Track];
}>();

const { isScrolling: isResultListScrolling, showScrolling: showResultListScrolling } = useScrollingState();

function handleResultScroll(event: Event) {
  showResultListScrolling();

  const target = event.currentTarget as HTMLElement;
  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
  if (distanceToBottom <= 80 && props.hasMore && !props.loading && !props.loadingMore) {
    emit('loadMore');
  }
}

</script>

<template>
  <div class="plugin-result-list transient-scrollbar" :class="{ 'is-scrolling': isResultListScrolling }" @scroll="handleResultScroll">
    <LoadingState v-if="loading" message="正在搜索插件音源..." />

    <PluginSearchTrackResults
      v-else-if="results.length > 0"
      :active-playback-track="activePlaybackTrack"
      :active-track-key="activeTrackKey"
      :downloaded-track-keys="downloadedTrackKeys"
      :favorite-track-ids="favoriteTrackIds"
      :is-playing="isPlaying"
      :load-more-error="loadMoreError"
      :loading-more="loadingMore"
      :pending-download-track-keys="pendingDownloadTrackKeys"
      :resolving-track-key="resolvingTrackKey"
      :results="results"
      :spectrum-levels="spectrumLevels"
      @download-track="emit('downloadTrack', $event)"
      @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
      @play-track="emit('playTrack', $event)"
      @retry-load-more="emit('retryLoadMore')"
      @toggle-favorite="emit('toggleFavorite', $event)"
    />

    <PluginSearchEmptyState v-else :message="error ?? '没有搜索结果'" @retry="emit('retry')" />
  </div>
</template>

<style scoped>
.plugin-result-list {
  flex: 1 1 0;
  margin-top: 22px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

</style>
