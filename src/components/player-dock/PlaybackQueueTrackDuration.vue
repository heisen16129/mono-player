<script setup lang="ts">
import { formatDuration } from '../../utils/format';

defineProps<{
  duration: number | null;
}>();
</script>

<template>
  <time>{{ formatDuration(duration) }}</time>
</template>

<style scoped>
time {
  padding-right: 4px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
