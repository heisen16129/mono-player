<script setup lang="ts">
import EmptyState from './EmptyState.vue';

defineProps<{
  message: string;
}>();
</script>

<template>
  <EmptyState class-name="empty-folder-note" :message="message" />
</template>

<style scoped>
:deep(.empty-folder-note) {
  margin: 4px 8px 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
