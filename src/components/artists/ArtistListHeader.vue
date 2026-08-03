<script setup lang="ts">
defineProps<{
  summary: string;
  title: string;
}>();
</script>

<template>
  <div class="panel-title artists-list-head">
    <h1>
      {{ title }}
      <span>{{ summary }}</span>
    </h1>
  </div>
</template>

<style scoped>
.artists-list-head h1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.artists-list-head h1 span {
  color: var(--smw-text-secondary);
  font-size: 13px;
  font-weight: 400;
}
</style>
