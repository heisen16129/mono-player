<script setup lang="ts">
import { Lock, Pause, Play, SkipBack, SkipForward, Unlock, X } from '@lucide/vue';

defineProps<{
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
  <span class="desktop-lyrics-actions">
    <button type="button" :aria-label="isLocked ? 'Unlock' : 'Lock'" :title="isLocked ? 'Unlock' : 'Lock'" @click="emit('toggleLocked')">
      <Lock v-if="isLocked" :size="17" />
      <Unlock v-else :size="17" />
    </button>
    <button v-if="!isLocked" type="button" aria-label="Previous" title="Previous" @click="emit('previous')">
      <SkipBack :size="17" />
    </button>
    <button v-if="!isLocked" type="button" :aria-label="isPlaying ? 'Pause' : 'Play'" :title="isPlaying ? 'Pause' : 'Play'" @click="emit('togglePlay')">
      <Pause v-if="isPlaying" :size="18" />
      <Play v-else :size="18" />
    </button>
    <button v-if="!isLocked" type="button" aria-label="Next" title="Next" @click="emit('next')">
      <SkipForward :size="17" />
    </button>
    <button v-if="!isLocked" type="button" aria-label="Close" title="Close" @click="emit('close')">
      <X :size="18" />
    </button>
  </span>
</template>

<style scoped>
.desktop-lyrics-actions {
  display: inline-flex;
  grid-column: 2;
  gap: 14px;
  align-items: center;
  justify-content: center;
}

.desktop-lyrics-actions button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.96);
  background: rgba(120, 120, 120, 0.32);
  cursor: pointer;
}

.desktop-lyrics-actions button:hover {
  color: #fff;
  background: rgba(90, 90, 90, 0.48);
}
</style>
