<script setup lang="ts">
defineProps<{
  text: string;
}>();
</script>

<template>
  <div class="app-startup-loading" role="status" aria-live="polite">
    <div class="app-startup-mark">M</div>
    <span>{{ text }}</span>
  </div>
</template>

<style scoped>
.app-startup-loading {
  position: relative;
  z-index: 2;
  grid-row: 1 / 3;
  display: grid;
  gap: 12px;
  place-content: center;
  justify-items: center;
  min-height: 100vh;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-canvas);
  font-size: 13px;
}

.app-startup-mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: var(--smw-button-primary);
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
}
</style>
