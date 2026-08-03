<script setup lang="ts">
defineProps<{
  countLabel: string;
  title: string;
}>();
</script>

<template>
  <h2 class="add-playlist-title">
    {{ title }}
    <span>{{ countLabel }}</span>
  </h2>
</template>

<style scoped>
.add-playlist-title {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 16px;
  font-weight: 560;
}

.add-playlist-title span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-weight: 420;
}
</style>
