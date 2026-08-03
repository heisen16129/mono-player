<script setup lang="ts">
import { formatDuration } from '../utils/format';

defineProps<{
  duration: number | null;
}>();
</script>

<template>
  <span class="track-duration-cell">{{ formatDuration(duration) }}</span>
</template>

<style scoped>
.track-duration-cell {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
