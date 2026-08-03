<script setup lang="ts">
import DesktopLyricsActionButtons from './DesktopLyricsActionButtons.vue';

defineProps<{
  currentTitle: string;
  isShellHovered: boolean;
  isLocked: boolean;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  close: [];
  next: [];
  previous: [];
  toggleLocked: [];
  togglePlay: [];
}>();
</script>

<template>
  <div class="desktop-lyrics-controls" :class="{ 'is-visible': isShellHovered }" @pointerdown.stop @dblclick.stop>
    <span class="desktop-lyrics-title">{{ currentTitle }}</span>
    <DesktopLyricsActionButtons
      :is-locked="isLocked"
      :is-playing="isPlaying"
      @close="emit('close')"
      @next="emit('next')"
      @previous="emit('previous')"
      @toggle-locked="emit('toggleLocked')"
      @toggle-play="emit('togglePlay')"
    />
    <span class="desktop-lyrics-control-spacer" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.desktop-lyrics-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  width: min(100%, 760px);
  min-height: 30px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 140ms ease, transform 140ms ease;
}

.desktop-lyrics-controls.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.desktop-lyrics-title {
  justify-self: end;
  max-width: min(220px, 100%);
  overflow: hidden;
  padding-right: 28px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 650;
  line-height: 24px;
  text-overflow: ellipsis;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.34);
  white-space: nowrap;
}

.desktop-lyrics-control-spacer {
  min-width: 0;
}
</style>
