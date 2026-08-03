<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <p class="metadata-error">{{ message }}</p>
</template>

<style scoped>
.metadata-error {
  margin: 0;
  padding: 0 18px 8px;
  color: #dc2626;
  font-size: 12px;
}
</style>
