<script setup lang="ts">
import type { Track } from '../types/music';
import TrackCoverThumb from './TrackCoverThumb.vue';

defineProps<{
  active: boolean;
  loading: boolean;
  playing: boolean;
  showCover: boolean;
  spectrumLevels: number[];
  track: Track;
}>();
</script>

<template>
  <span class="track-title">
    <TrackCoverThumb
      v-if="showCover"
      :track="track"
      :active="active"
      :loading="loading"
      :playing="playing"
      :spectrum-levels="spectrumLevels"
    />
    <span class="track-title-text" :title="track.title">{{ track.title }}</span>
  </span>
</template>

<style scoped>
.track-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-title-text {
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
