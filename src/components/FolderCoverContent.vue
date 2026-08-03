<script setup lang="ts">
import DefaultCover from './DefaultCover.vue';

defineProps<{
  shouldUseGrid: boolean;
  visibleCovers: (string | null)[];
}>();

const emit = defineEmits<{
  coverError: [index: number];
}>();
</script>

<template>
  <template v-if="shouldUseGrid">
    <span v-for="index in 4" :key="index" class="folder-cover-cell">
      <img v-if="visibleCovers[index - 1]" class="folder-cover-image" :src="visibleCovers[index - 1] ?? undefined" alt="" @error="emit('coverError', index - 1)" />
    </span>
  </template>
  <img v-else-if="visibleCovers[0]" class="folder-cover-image" :src="visibleCovers[0]" alt="" @error="emit('coverError', 0)" />
  <template v-else>
    <DefaultCover class="folder-cover-placeholder-icon" :size="80" :stroke-width="2.1" />
  </template>
</template>

<style scoped>
.folder-cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.folder-cover-cell {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
}

.folder-cover-placeholder-icon {
  width: 38%;
  height: 38%;
  opacity: 0.92;
  transform: translateY(-6%);
}
</style>
