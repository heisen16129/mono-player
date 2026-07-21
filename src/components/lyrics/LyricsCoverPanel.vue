<script setup lang="ts">
import DefaultCover from '../DefaultCover.vue';

defineProps<{
  coverUrl: string;
}>();

defineEmits<{
  error: [];
}>();
</script>

<template>
  <div class="lyrics-cover album-cover" :class="{ 'has-cover-image': coverUrl }">
    <img v-if="coverUrl" :src="coverUrl" alt="" @error="$emit('error')" />
    <template v-else>
      <DefaultCover class="lyrics-cover-placeholder-icon" :size="88" :stroke-width="2.1" />
    </template>
  </div>
</template>

<style scoped>
.lyrics-cover {
  position: relative;
  display: grid;
  width: min(360px, 30vw);
  max-width: 360px;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.16);
}

.lyrics-cover::before,
.lyrics-cover.has-cover-image::before {
  display: none;
}

.lyrics-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lyrics-cover-placeholder-icon {
  opacity: 0.92;
}
</style>
