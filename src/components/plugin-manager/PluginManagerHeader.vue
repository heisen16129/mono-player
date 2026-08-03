<script setup lang="ts">
import PageHeader from '../PageHeader.vue';

defineProps<{
  subtitle: string;
  title: string;
}>();
</script>

<template>
  <PageHeader class="plugin-header" :subtitle="subtitle" :title="title" />
</template>

<style scoped>
:deep(.plugin-header) {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  padding: 0 116px 18px 0;
  border-bottom: 1px solid var(--smw-border);
}

:deep(.plugin-header .page-header-title) {
  margin: 0 0 6px;
  color: var(--smw-text-primary);
  font-size: 28px;
  font-weight: 760;
  line-height: 1.15;
}

:deep(.plugin-header .page-header-subtitle) {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

@media (max-width: 860px) {
  :deep(.plugin-header) {
    display: grid;
    padding-right: 0;
  }
}
</style>
