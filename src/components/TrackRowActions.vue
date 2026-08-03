<script setup lang="ts">
import type { TrackRowActionsEmits, TrackRowActionsProps } from '../types/trackTable';
import TrackDownloadActionButton from './TrackDownloadActionButton.vue';
import TrackFavoriteActionButton from './TrackFavoriteActionButton.vue';

defineProps<TrackRowActionsProps>();

defineEmits<TrackRowActionsEmits>();
</script>

<template>
  <span class="track-actions">
    <TrackFavoriteActionButton
      v-if="showFavoriteAction"
      :is-favorite="isFavorite"
      :label="toggleFavoriteLabel"
      @toggle="$emit('toggleFavorite', track)"
    />
    <TrackDownloadActionButton
      v-if="enableDownloadAction"
      :can-download="canDownload"
      :is-downloaded="isDownloaded"
      :is-pending-download="isPendingDownload"
      :label="downloadActionLabel"
      @download="$emit('downloadTrack', track)"
    />
  </span>
</template>

<style scoped>
.track-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  color: var(--smw-text-secondary);
}

</style>
