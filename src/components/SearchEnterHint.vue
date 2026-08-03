<script setup lang="ts">
defineProps<{
  hint: string;
}>();
</script>

<template>
  <span class="enter-hint">
    <kbd>Enter</kbd>
    <span>{{ hint }}</span>
  </span>
</template>

<style scoped>
.enter-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.enter-hint kbd {
  display: inline-grid;
  min-width: 42px;
  height: 22px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  font-family: inherit;
  font-size: 11px;
  font-weight: 520;
}

@media (max-width: 980px) {
  .enter-hint span {
    display: none;
  }
}
</style>
