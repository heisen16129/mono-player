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
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 24px;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 12px;
}

@media (max-width: 720px) {
  .metadata-dialog-body {
    grid-template-columns: 1fr;
  }
}
</style>
