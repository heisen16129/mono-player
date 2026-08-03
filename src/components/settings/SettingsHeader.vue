<script setup lang="ts">
import PageHeader from '../PageHeader.vue';

defineProps<{
  title: string;
}>();
</script>

<template>
  <PageHeader class="settings-header" :title="title">
    <slot />
  </PageHeader>
</template>

<style scoped>
:deep(.settings-header) {
  border-bottom: 1px solid var(--smw-border);
}

:deep(.settings-header .page-header-title) {
  margin: 0 0 18px;
  font-size: 30px;
  font-weight: 760;
  line-height: 1.1;
}

@media (max-width: 820px) {
  :deep(.settings-header .page-header-title) {
    font-size: 25px;
  }
}
</style>
