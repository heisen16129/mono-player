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
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

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
