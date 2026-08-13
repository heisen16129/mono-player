<script setup lang="ts">
import DefaultCover from './DefaultCover.vue';
import TrackCoverEqualizer from './TrackCoverEqualizer.vue';

defineProps<{
  active?: boolean;
  coverUrl: string | null;
  loading?: boolean;
  playing?: boolean;
  trackId: number;
  trackTitle: string;
}>();

const emit = defineEmits<{
  imageError: [];
}>();
</script>

<template>
  <img v-if="coverUrl" class="track-cover-image" :src="coverUrl" alt="" @error="emit('imageError')" />
  <DefaultCover v-else-if="!active && !loading" class="cover-placeholder-icon" :size="18" :stroke-width="2.4" />
  <TrackCoverEqualizer
    v-if="active || loading"
    :loading="loading"
    :playing="playing"
    :track-id="trackId"
    :track-title="trackTitle"
  />
</template>

<style scoped>
.track-cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}
</style>
