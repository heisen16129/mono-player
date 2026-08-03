<script setup lang="ts">
import { Trash2 } from '@lucide/vue';

defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  remove: [];
}>();
</script>

<template>
  <button
    class="theme-card-delete"
    type="button"
    :aria-label="label"
    :title="label"
    @click.stop="emit('remove')"
    @keydown.enter.stop.prevent="emit('remove')"
    @keydown.space.stop.prevent="emit('remove')"
  >
    <Trash2 :size="14" />
  </button>
</template>

<style scoped>
.theme-card-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  display: grid;
  width: 23px;
  height: 23px;
  padding: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--smw-border) 72%, transparent);
  border-radius: 50%;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  opacity: var(--theme-delete-opacity, 0);
  pointer-events: var(--theme-delete-pointer-events, none);
  transition:
    opacity 140ms ease,
    color 140ms ease,
    background 140ms ease;
}

.theme-card-delete:hover,
.theme-card-delete:focus-visible {
  color: #e5484d;
  background: color-mix(in srgb, #e5484d 12%, var(--smw-bg-panel));
  outline: none;
}
</style>
