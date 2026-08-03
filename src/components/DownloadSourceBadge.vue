<script setup lang="ts">
defineProps<{
  sourceName?: string | null;
}>();
</script>

<template>
  <i class="download-source-badge">{{ sourceName }}</i>
</template>

<style scoped>
.download-source-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  color: #fff;
  background: var(--smw-button-primary);
  font-style: normal;
  font-weight: 650;
}
</style>
