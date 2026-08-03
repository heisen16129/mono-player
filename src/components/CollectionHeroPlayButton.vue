<script setup lang="ts">
import { Play } from '@lucide/vue';

defineProps<{
  disabled: boolean;
  label: string;
}>();

const emit = defineEmits<{
  play: [];
}>();
</script>

<template>
  <button class="collection-play-button" type="button" :disabled="disabled" @click="emit('play')">
    <Play :size="16" fill="currentColor" />{{ label }}
  </button>
</template>

<style scoped>
.collection-play-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border: 1px solid var(--smw-button-primary);
  border-radius: 6px;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 620;
}

.collection-play-button:hover:not(:disabled) {
  filter: brightness(0.96);
}

.collection-play-button:disabled {
  cursor: default;
  opacity: 0.48;
}

@media (max-height: 760px) and (min-width: 821px) {
  .collection-play-button {
    height: 38px;
    padding: 0 15px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .collection-play-button {
    height: 34px;
    padding: 0 13px;
    font-size: 13px;
  }
}
</style>
