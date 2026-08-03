<script setup lang="ts">
import EmptyState from './EmptyState.vue';

defineProps<{
  message: string;
}>();
</script>

<template>
  <EmptyState class-name="download-empty" :message="message" />
</template>

<style scoped>
:deep(.download-empty) {
  min-height: 220px;
  font-size: 13px;
}
</style>
