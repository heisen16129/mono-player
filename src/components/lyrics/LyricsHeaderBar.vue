<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';

defineProps<{
  album: string;
  artist: string;
  closeLabel: string;
  title: string;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <button class="lyrics-close icon-button" type="button" :aria-label="closeLabel" @click="$emit('close')">
    <ChevronDown :size="22" />
  </button>

  <header class="lyrics-heading">
    <h1>{{ title }}</h1>
    <p>
      {{ artist }}
      <span>-</span>
      {{ album }}
    </p>
  </header>
</template>

<style scoped>
.lyrics-close {
  position: fixed;
  top: 48px;
  left: 30px;
  z-index: 20;
}

.lyrics-heading {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-top: 16px;
  text-align: center;
}

.lyrics-heading h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 620;
  line-height: 1.1;
}

.lyrics-heading p {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
}
</style>
