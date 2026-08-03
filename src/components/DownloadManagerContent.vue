<script setup lang="ts">
import DownloadEmptyState from './DownloadEmptyState.vue';
import DownloadTrackTable from './DownloadTrackTable.vue';
import type { DownloadManagerContentEmits, DownloadManagerContentProps } from '../types/downloadManager';

defineProps<DownloadManagerContentProps>();

const emit = defineEmits<DownloadManagerContentEmits>();
</script>

<template>
  <div class="download-manager-content">
    <DownloadTrackTable
      v-if="tracks.length > 0"
      :active-track="activeTrack"
      :download-item-for-track="downloadItemForTrack"
      :favorite-track-ids="favoriteTrackIds"
      :is-playing="isPlaying"
      :row-class="rowClass"
      :show-favorite-action="showFavoriteAction"
      :spectrum-levels="spectrumLevels"
      :tracks="tracks"
      @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
      @play-track="emit('playTrack', $event)"
      @select-track="emit('selectTrack', $event)"
      @toggle-favorite="emit('toggleFavorite', $event)"
    />

    <DownloadEmptyState v-else :message="emptyMessage" />
  </div>
</template>

<style scoped>
.download-manager-content {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.download-manager-content :deep(.track-table-scrollable) {
  height: 100%;
  box-sizing: border-box;
}
</style>
