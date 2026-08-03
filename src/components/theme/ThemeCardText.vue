<script setup lang="ts">
defineProps<{
  author?: string;
  authorLabel?: string;
  subtitle?: string;
  title: string;
}>();
</script>

<template>
  <strong>{{ title }}</strong>
  <small>{{ subtitle ?? `${authorLabel}: ${author}` }}</small>
</template>

<style scoped>
strong {
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

small {
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
