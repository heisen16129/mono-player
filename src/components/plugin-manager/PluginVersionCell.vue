<script setup lang="ts">
defineProps<{
  version: string;
}>();
</script>

<template>
  <span>{{ version }}</span>
</template>
