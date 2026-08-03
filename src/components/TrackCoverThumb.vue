<script setup lang="ts">
import { toRef } from 'vue';
import { useTrackCoverThumbUrl } from '../composables/useTrackCoverThumbUrl';
import type { Track } from '../types/music';
import TrackCoverThumbContent from './TrackCoverThumbContent.vue';

const props = defineProps<{
  track: Track;
  active?: boolean;
  loading?: boolean;
  playing?: boolean;
  spectrumLevels?: number[];
}>();

const { coverUrl, handleImageError, setCoverRoot } = useTrackCoverThumbUrl(toRef(props, 'track'));
</script>

<template>
  <span :ref="setCoverRoot" class="track-cover-thumb" :class="{ 'has-cover': coverUrl, active, loading, playing }" aria-hidden="true">
    <TrackCoverThumbContent
      :active="active"
      :cover-url="coverUrl"
      :loading="loading"
      :playing="playing"
      :spectrum-levels="spectrumLevels"
      :track-id="track.id"
      :track-title="track.title"
      @image-error="handleImageError"
    />
  </span>
</template>

<style scoped>
.track-cover-thumb {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--smw-border, #d8e3f2) 72%, transparent);
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
}

.track-cover-thumb.active::after,
.track-cover-thumb.loading::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: color-mix(in srgb, #000 42%, transparent);
  content: "";
}

</style>
