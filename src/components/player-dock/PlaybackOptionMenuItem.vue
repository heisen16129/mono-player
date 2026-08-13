<script setup lang="ts">
import type { PlaybackOptionMenuItem } from './PlaybackOptionMenu.vue';

defineProps<{
  active: boolean;
  item: PlaybackOptionMenuItem;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <button
    type="button"
    role="menuitemradio"
    :class="{ 'is-active': active }"
    :aria-checked="active"
    :disabled="item.disabled"
    :title="item.title ?? item.label"
    @click="!item.disabled && emit('select', item.id)"
  >
    {{ item.label }}
  </button>
</template>

<style scoped>
button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 28px;
  min-width: max-content;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

button:hover,
button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

button.is-active {
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
  font-weight: 700;
}
</style>
