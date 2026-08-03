<script setup lang="ts">
import { toRef } from 'vue';
import { usePluginSearchTableTracks } from '../../composables/usePluginSearchTableTracks';
import type { Track } from '../../types/music';
import type { PluginSearchTrack } from '../../types/plugin';
import TrackTable from '../TrackTable.vue';
import PluginSearchLoadMoreFooter from './PluginSearchLoadMoreFooter.vue';

const props = defineProps<{
  activePlaybackTrack: Track | null;
  activeTrackKey: string | null;
  downloadedTrackKeys: string[];
  favoriteTrackIds: number[];
  isPlaying: boolean;
  loadMoreError: string | null;
  loadingMore: boolean;
  pendingDownloadTrackKeys: string[];
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  spectrumLevels: number[];
}>();

const emit = defineEmits<{
  downloadTrack: [track: PluginSearchTrack];
  openTrackMenu: [track: PluginSearchTrack, x: number, y: number];
  playTrack: [track: PluginSearchTrack];
  retryLoadMore: [];
  toggleFavorite: [track: Track];
}>();

const {
  activeTrack,
  getPluginTrackForTableTrack,
  getTrackIdentityKey,
  pluginTracks,
  preparingTrackId,
} = usePluginSearchTableTracks({
  activePlaybackTrack: toRef(props, 'activePlaybackTrack'),
  activeTrackKey: toRef(props, 'activeTrackKey'),
  resolvingTrackKey: toRef(props, 'resolvingTrackKey'),
  results: toRef(props, 'results'),
});

function playTableTrack(track: Track) {
  const pluginTrack = getPluginTrackForTableTrack(track);
  if (pluginTrack) emit('playTrack', pluginTrack);
}

function downloadTableTrack(track: Track) {
  const pluginTrack = getPluginTrackForTableTrack(track);
  if (pluginTrack) emit('downloadTrack', pluginTrack);
}

function openTableTrackMenu(track: Track, x: number, y: number) {
  const pluginTrack = getPluginTrackForTableTrack(track);
  if (pluginTrack) emit('openTrackMenu', pluginTrack, x, y);
}
</script>

<template>
  <div class="plugin-result-body">
    <TrackTable
      label="Plugin search results"
      :tracks="pluginTracks"
      :active-track="activeTrack"
      :downloaded-track-keys="downloadedTrackKeys"
      :pending-download-track-keys="pendingDownloadTrackKeys"
      :preparing-track-id="preparingTrackId"
      :spectrum-levels="spectrumLevels"
      :track-key="getTrackIdentityKey"
      enable-download-action
      :favorite-track-ids="favoriteTrackIds"
      hide-action-header
      :is-playing="isPlaying"
      disable-internal-paging
      wide
      enable-context-menu
      @select-track="() => {}"
      @play-track="playTableTrack"
      @download-track="downloadTableTrack"
      @toggle-favorite="emit('toggleFavorite', $event)"
      @open-track-menu="openTableTrackMenu"
    />
    <PluginSearchLoadMoreFooter
      :load-more-error="loadMoreError"
      :loading-more="loadingMore"
      @retry="emit('retryLoadMore')"
    />
  </div>
</template>

<style scoped>
.plugin-result-body {
  min-width: 0;
}
</style>
