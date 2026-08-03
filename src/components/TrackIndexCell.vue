<script setup lang="ts">
defineProps<{
  index: number;
}>();
</script>

<template>
  <span class="track-index-cell">{{ index + 1 }}</span>
</template>

<style scoped>
.track-index-cell {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
