<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <p class="scan-empty">{{ message }}</p>
</template>

<style scoped>
.scan-empty {
  margin: 0;
  padding: 28px 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
