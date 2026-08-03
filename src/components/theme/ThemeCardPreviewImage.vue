<script setup lang="ts">
defineProps<{
  src: string;
}>();
</script>

<template>
  <img class="theme-card-image" :src="src" alt="" draggable="false" />
</template>

<style scoped>
.theme-card-image {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
</style>
