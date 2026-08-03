<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue';

defineProps<{
  direction: 'next' | 'previous';
  label: string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button class="plugin-screenshot-nav" :class="direction" type="button" :aria-label="label" @click="emit('click')">
    <ChevronLeft v-if="direction === 'previous'" :size="17" />
    <ChevronRight v-else :size="17" />
  </button>
</template>

<style scoped>
.plugin-screenshot-nav {
  position: absolute;
  top: 50%;
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--smw-border) 76%, transparent);
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-input) 88%, transparent);
  cursor: pointer;
  transform: translateY(-50%);
}

.plugin-screenshot-nav:hover {
  background: var(--smw-bg-input);
}

.plugin-screenshot-nav.previous {
  left: 8px;
}

.plugin-screenshot-nav.next {
  right: 8px;
}
</style>
