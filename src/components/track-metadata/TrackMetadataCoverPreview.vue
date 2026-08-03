<script setup lang="ts">
import DefaultCover from '../DefaultCover.vue';

defineProps<{
  coverPreviewUrl: string;
}>();

const emit = defineEmits<{
  coverError: [];
}>();
</script>

<template>
  <div class="metadata-cover" :class="{ 'has-cover': coverPreviewUrl }">
    <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="" @error="emit('coverError')" />
    <DefaultCover v-else :size="56" :stroke-width="2.2" />
  </div>
</template>

<style scoped>
.metadata-cover {
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: color-mix(in srgb, var(--smw-text-secondary) 70%, transparent);
  background: color-mix(in srgb, var(--smw-bg-input) 88%, transparent);
}

.metadata-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 720px) {
  .metadata-cover {
    max-width: 220px;
  }
}
</style>
