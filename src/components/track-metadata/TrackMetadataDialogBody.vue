<script setup lang="ts">
</script>

<template>
  <div class="metadata-dialog-body">
    <slot />
  </div>
</template>

<style scoped>
.metadata-dialog-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 16px 20px 12px;
}

@media (max-width: 720px) {
  .metadata-dialog-body {
    grid-template-columns: 1fr;
  }
}
</style>
