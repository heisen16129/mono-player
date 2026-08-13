<script setup lang="ts">
import { ref, watch } from 'vue';
import DefaultCover from '../DefaultCover.vue';
import { artworkDisplaySrc } from '../../utils/artwork';

const props = defineProps<{
  artwork?: string | null;
}>();

const hasArtworkError = ref(false);

watch(
  () => props.artwork,
  () => {
    hasArtworkError.value = false;
  },
);
</script>

<template>
  <span class="lyrics-search-cover">
    <img
      v-if="artworkDisplaySrc(props.artwork) && !hasArtworkError"
      :src="artworkDisplaySrc(props.artwork)"
      alt=""
      @error="hasArtworkError = true"
    />
    <DefaultCover v-else :size="20" :stroke-width="2.4" />
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
