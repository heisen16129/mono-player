<script setup lang="ts">
import { formatDuration } from '../../utils/format';

defineProps<{
  currentTime: number;
  totalDurationLabel: string;
}>();
</script>

<template>
  <span class="time-pair">
    <span>{{ formatDuration(currentTime) }}</span>
    <span>/</span>
    <span>{{ totalDurationLabel }}</span>
  </span>
</template>

<style scoped>
.time-pair {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--smw-text-secondary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

.time-pair span:first-child {
  font-weight: 500;
}
</style>
