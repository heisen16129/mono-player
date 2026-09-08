<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';

defineProps<{
  label: string;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <button
    class="lyrics-collapse-button icon-button"
    type="button"
    :aria-label="label"
    :title="label"
    @click="$emit('close')"
  >
    <ChevronDown :size="22" />
  </button>
</template>

<style scoped>
.lyrics-collapse-button {
  position: absolute;
  top: 0;
  left: calc(var(--lyrics-control-center-x) - 17px);
  color: var(--smw-text-secondary);
  pointer-events: auto;
}

.lyrics-collapse-button:hover {
  color: var(--smw-text-primary);
  background: transparent;
}
</style>
