<script setup lang="ts">
import EmptyState from '../EmptyState.vue';

defineProps<{
  message: string;
}>();
</script>

<template>
  <EmptyState class-name="empty-plugins" :message="message" />
</template>

<style scoped>
:deep(.empty-plugins) {
  padding: 34px 16px;
  font-size: 13px;
}
</style>
