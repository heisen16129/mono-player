<script setup lang="ts">
import PageHeader from '../PageHeader.vue';

defineProps<{
  title: string;
}>();
</script>

<template>
  <PageHeader class="theme-toolbar" :title="title" title-class="theme-view-title" />
</template>

<style scoped>
:deep(.theme-toolbar) {
  display: flex;
  align-items: center;
  min-height: 42px;
}

:deep(.theme-view-title) {
  color: var(--smw-text-primary);
  font-size: 18px;
  font-weight: 720;
  line-height: 1.2;
}
</style>
