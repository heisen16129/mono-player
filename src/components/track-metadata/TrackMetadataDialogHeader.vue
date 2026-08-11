<script setup lang="ts">
defineProps<{
  trackTitle: string;
}>();
</script>

<template>
  <div class="metadata-dialog-title">
    <h2>更改元数据</h2>
    <p>{{ trackTitle }}</p>
  </div>
</template>

<style scoped>
.metadata-dialog-title h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 650;
  line-height: 1.25;
}

.metadata-dialog-title p {
  max-width: 520px;
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
