<script setup lang="ts">
import { Music } from '@lucide/vue';
import { artworkDisplaySrc } from '../../utils/artwork';

defineProps<{
  artwork?: string | null;
}>();
</script>

<template>
  <span class="lyrics-search-cover">
    <img v-if="artwork" :src="artworkDisplaySrc(artwork)" alt="" />
    <Music v-else :size="20" :stroke-width="2.4" />
  </span>
</template>

<style scoped>
.lyrics-search-cover {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  overflow: hidden;
  border-radius: 7px;
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
}

.lyrics-search-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
