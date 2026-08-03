<script setup lang="ts">
import { ref } from 'vue';
import { useScrollingState } from '../composables/useScrollingState';
import type { WorkspaceTrackListEmits, WorkspaceTrackListProps } from '../types/workspace';
import TrackTable from './TrackTable.vue';
import WorkspaceEmptyState from './WorkspaceEmptyState.vue';

defineProps<WorkspaceTrackListProps>();

const emit = defineEmits<WorkspaceTrackListEmits>();

const trackTableRef = ref<InstanceType<typeof TrackTable> | null>(null);
const { isScrolling, showScrolling } = useScrollingState();

async function scrollToTrack(trackId: number) {
  await trackTableRef.value?.scrollToTrack(trackId);
}

function handleScroll(event: Event) {
  showScrolling();
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.scrollHeight - target.scrollTop - target.clientHeight < 180) {
    trackTableRef.value?.loadNextPage();
  }
}

defineExpose({
  scrollToTrack,
});
</script>

<template>
  <div class="track-scroll-area transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" @scroll="handleScroll">
    <p v-if="error" class="error">{{ error }}</p>
    <WorkspaceEmptyState v-if="tracks.length === 0" :message="emptyMessage" />

    <TrackTable
      v-else
      ref="trackTableRef"
      label="Songs"
      :tracks="tracks"
      :active-track="activeTrack"
      :favorite-track-ids="favoriteTrackIds"
      :preparing-track-id="preparingTrackId"
      :spectrum-levels="spectrumLevels"
      :is-playing="isPlaying"
      :wide="isWideCollection"
      disable-internal-paging
      enable-artist-links
      enable-context-menu
      @select-track="emit('selectTrack', $event)"
      @play-track="emit('playTrack', $event)"
      @toggle-favorite="emit('toggleFavorite', $event)"
      @open-artist="emit('openArtist', $event)"
      @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
    />
  </div>
</template>

<style scoped>
.error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--smw-error-border);
  border-radius: 8px;
  color: var(--smw-error-text);
  background: var(--smw-error-bg);
  font-size: 13px;
}

.track-scroll-area {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0;
}
</style>
