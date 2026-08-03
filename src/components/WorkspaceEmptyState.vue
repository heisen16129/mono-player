<script setup lang="ts">
import EmptyState from './EmptyState.vue';

defineProps<{
  message: string;
}>();
</script>

<template>
  <EmptyState class-name="workspace-empty" :message="message" />
</template>

<style scoped>
:deep(.workspace-empty) {
  margin-top: 36px;
}
</style>
