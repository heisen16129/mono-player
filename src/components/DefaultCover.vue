<script setup lang="ts">
import { Music } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number;
  strokeWidth?: number;
}>(), {
  size: 24,
  strokeWidth: 2.4,
});
</script>

<template>
  <span class="default-cover" aria-hidden="true">
    <Music class="default-cover-icon" :size="size" :stroke-width="strokeWidth" />
  </span>
</template>

<style scoped>
.default-cover {
  display: inline-grid;
  place-items: center;
  color: currentColor;
}

.default-cover-icon {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>
