<script setup lang="ts">
import { LocateFixed } from '@lucide/vue';

defineProps<{
  disabled: boolean;
  label: string;
}>();

const emit = defineEmits<{
  locate: [];
}>();
</script>

<template>
  <button class="collection-locate-button" type="button" :disabled="disabled" :aria-label="label" @click="emit('locate')">
    <LocateFixed :size="17" />
  </button>
</template>

<style scoped>
.collection-locate-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.collection-locate-button:hover {
  color: var(--smw-text-primary);
}

.collection-locate-button svg {
  color: currentColor;
  stroke: currentColor;
}

.collection-locate-button:disabled {
  cursor: default;
  color: var(--smw-icon-muted);
  opacity: 1;
}

@media (max-height: 660px) and (min-width: 821px) {
  .collection-locate-button {
    width: 32px;
    height: 32px;
  }
}
</style>
