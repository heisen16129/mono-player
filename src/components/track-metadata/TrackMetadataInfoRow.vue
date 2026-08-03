<script setup lang="ts">
defineProps<{
  label: string;
  title?: string;
  value: string;
}>();
</script>

<template>
  <div class="metadata-info-row">
    <dt>{{ label }}</dt>
    <dd :title="title">{{ value }}</dd>
  </div>
</template>

<style scoped>
.metadata-info-row {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
}

.metadata-info-row dt {
  color: var(--smw-text-secondary);
}

.metadata-info-row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--smw-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
