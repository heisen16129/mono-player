<script setup lang="ts">
import { MonitorUp } from '@lucide/vue';

const emit = defineEmits<{
  open: [];
}>();
</script>

<template>
  <button class="icon-button desktop-lyrics-entry-button" type="button" aria-label="打开桌面歌词" title="打开桌面歌词" @click="emit('open')">
    <MonitorUp class="desktop-lyrics-entry-icon" :size="18" />
  </button>
</template>

<style scoped>
.desktop-lyrics-entry-button {
  width: 28px;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--smw-text-body);
}

.desktop-lyrics-entry-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
</style>
