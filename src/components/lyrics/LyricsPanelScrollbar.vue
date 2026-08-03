<script setup lang="ts">
defineProps<{
  top: number;
  visible: boolean;
}>();
</script>

<template>
  <span class="lyrics-scrollbar" :class="{ visible }" aria-hidden="true">
    <i :style="{ transform: `translateY(${top}px)` }"></i>
  </span>
</template>

<style scoped>
.lyrics-scrollbar {
  position: absolute;
  top: 50%;
  right: 0;
  width: 4px;
  height: 220px;
  border-radius: 999px;
  background: var(--smw-border);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 160ms ease;
}

.lyrics-scrollbar.visible {
  opacity: 1;
}

.lyrics-scrollbar i {
  display: block;
  width: 4px;
  height: 66px;
  border-radius: inherit;
  background: var(--smw-text-secondary);
  transition: transform 180ms ease;
}
</style>
