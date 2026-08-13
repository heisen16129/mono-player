<script setup lang="ts">
import DownloadSourceBadge from './DownloadSourceBadge.vue';
import DownloadStatusCell from './DownloadStatusCell.vue';
import TrackTable from './TrackTable.vue';
import type { DownloadItem, Track } from '../types/music';
import { downloadTrackIdentityKey } from '../utils/downloadedTrack';

defineProps<{
  activeTrack: Track | null;
  downloadItemForTrack: (track: Track) => DownloadItem | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  rowClass: (track: Track) => Record<string, boolean>;
  showFavoriteAction: boolean;
  tracks: Track[];
}>();

const emit = defineEmits<{
  openTrackMenu: [track: Track, x: number, y: number];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}>();

</script>

<template>
  <TrackTable
    :active-track="activeTrack"
    disable-internal-paging
    enable-context-menu
    extra-columns="118px 88px"
    :favorite-track-ids="favoriteTrackIds"
    :is-playing="isPlaying"
    highlight-class="is-context-open"
    label="下载管理"
    :row-class="rowClass"
    scrollable
    :show-favorite-action="showFavoriteAction"
    :tracks="tracks"
    :track-key="downloadTrackIdentityKey"
    wide
    @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
    @play-track="emit('playTrack', $event)"
    @select-track="emit('selectTrack', $event)"
    @toggle-favorite="emit('toggleFavorite', $event)"
  >
    <template #extraHead>
      <span>来源</span>
      <span>状态</span>
    </template>
    <template #extraCells="{ track }">
      <span><DownloadSourceBadge :source-name="downloadItemForTrack(track)?.sourceName" /></span>
      <DownloadStatusCell :item="downloadItemForTrack(track)" />
    </template>
  </TrackTable>
</template>
