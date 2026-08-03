<script setup lang="ts">
import { Volume2 } from '@lucide/vue';

defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <button class="icon-button volume-button" type="button" :aria-label="label" @click.stop="emit('toggle')">
    <Volume2 :size="18" />
  </button>
</template>

<style scoped>
.volume-button {
  color: var(--smw-text-body);
}

.volume-button:hover,
.volume-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.volume-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
</style>
