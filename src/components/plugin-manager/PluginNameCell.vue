<script setup lang="ts">
defineProps<{
  name: string;
}>();
</script>

<template>
  <strong>{{ name }}</strong>
</template>

<style scoped>
strong {
  color: var(--smw-text-primary);
  font-weight: 560;
}
</style>
