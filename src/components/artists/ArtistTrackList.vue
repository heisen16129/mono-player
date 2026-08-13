<script setup lang="ts">
import { ref } from 'vue';
import { useScrollingState } from '../../composables/useScrollingState';
import type { ArtistTrackListEmits, ArtistTrackListProps } from '../../types/artists';
import TrackTable from '../TrackTable.vue';

defineProps<ArtistTrackListProps>();

const emit = defineEmits<ArtistTrackListEmits>();

const trackTableRef = ref<InstanceType<typeof TrackTable> | null>(null);
const { isScrolling, showScrolling } = useScrollingState();

function handleScroll(event: Event) {
  showScrolling();
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.scrollHeight - target.scrollTop - target.clientHeight < 180) {
    trackTableRef.value?.loadNextPage();
  }
}
</script>

<template>
  <div class="artist-track-scroll transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" @scroll="handleScroll">
    <TrackTable
      v-if="tracks"
      ref="trackTableRef"
      class="artist-track-table"
      :label="label"
      :tracks="tracks"
      :active-track="activeTrack"
      :favorite-track-ids="favoriteTrackIds"
      :is-playing="isPlaying"
      wide
      enable-context-menu
      @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
      @select-track="emit('selectTrack', $event)"
      @play-track="emit('playTrack', $event)"
      @toggle-favorite="emit('toggleFavorite', $event)"
    />
  </div>
</template>

<style scoped>
.artist-track-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0;
}
</style>
