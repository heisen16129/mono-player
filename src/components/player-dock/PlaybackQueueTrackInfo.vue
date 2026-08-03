<script setup lang="ts">
defineProps<{
  artist: string;
  title: string;
}>();
</script>

<template>
  <span class="queue-info">
    <strong>{{ title }}</strong>
    <small>{{ artist }}</small>
  </span>
</template>

<style scoped>
.queue-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.queue-info strong,
.queue-info small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-info strong {
  font-size: 13px;
  font-weight: 600;
}

.queue-info small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
