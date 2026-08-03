<script setup lang="ts">
import { Gauge } from '@lucide/vue';

defineProps<{
  label: string;
}>();
</script>

<template>
  <button class="icon-button speed-button" type="button" :aria-label="label">
    <Gauge :size="18" />
  </button>
</template>

<style scoped>
.speed-button {
  color: var(--smw-text-body);
}

.speed-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.speed-button:hover,
.speed-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}
</style>
