<script setup lang="ts">
defineProps<{
  album: string | null;
  fallback: string;
}>();
</script>

<template>
  <span class="track-album-cell">{{ album || fallback }}</span>
</template>

<style scoped>
.track-album-cell {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
