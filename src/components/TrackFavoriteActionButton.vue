<script setup lang="ts">
import { Heart } from '@lucide/vue';

defineProps<{
  isFavorite: boolean;
  label: string;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <button
    class="favorite-icon"
    :class="{ 'is-favorite': isFavorite }"
    type="button"
    :aria-label="label"
    @click.stop="emit('toggle')"
  >
    <Heart :size="17" :fill="isFavorite ? 'currentColor' : 'none'" />
  </button>
</template>

<style scoped>
.favorite-icon {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, transform 140ms ease;
}

.favorite-icon.is-favorite {
  color: #e5484d;
}

.favorite-icon:hover {
  color: #e5484d;
  background: color-mix(in srgb, #e5484d 10%, transparent);
  border-radius: 999px;
}

.favorite-icon:active {
  transform: scale(0.94);
}

.favorite-icon:focus-visible {
  border-radius: 999px;
  outline: 2px solid var(--smw-text-primary);
  outline-offset: 3px;
}

.favorite-icon.is-favorite svg {
  color: #e5484d;
  fill: currentColor;
  stroke: currentColor;
}
</style>
