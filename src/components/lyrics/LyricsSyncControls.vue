<script setup lang="ts">
const emit = defineEmits<{
  shiftTiming: [deltaSeconds: number];
}>();
</script>

<template>
  <div class="lyrics-sync-controls" @pointerdown.stop>
    <button type="button" title="歌词快0.5秒" aria-label="歌词快0.5秒" @click="emit('shiftTiming', -0.5)">
      <span>-</span>
      <strong>0.5</strong>
    </button>
    <button type="button" title="歌词慢0.5秒" aria-label="歌词慢0.5秒" @click="emit('shiftTiming', 0.5)">
      <span>+</span>
      <strong>0.5</strong>
    </button>
  </div>
</template>

<style scoped>
.lyrics-sync-controls {
  position: absolute;
  top: 50%;
  right: 18px;
  z-index: 2;
  display: grid;
  gap: 16px;
  transform: translateY(-50%);
}

.lyrics-sync-controls button {
  display: grid;
  grid-template-rows: 16px 14px;
  width: 38px;
  height: 38px;
  place-items: center;
  padding: 0;
  border: 1.5px solid color-mix(in srgb, var(--smw-lyrics-current) 78%, var(--smw-text-primary));
  border-radius: 6px;
  color: var(--smw-lyrics-current);
  background: color-mix(in srgb, var(--smw-bg-workspace) 82%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  line-height: 1;
  backdrop-filter: blur(10px);
}

.lyrics-sync-controls button:hover,
.lyrics-sync-controls button:focus-visible {
  background: color-mix(in srgb, var(--smw-bg-hover) 88%, transparent);
  transform: translateY(-1px);
}

.lyrics-sync-controls button span {
  align-self: end;
  font-size: 15px;
  font-weight: 700;
}

.lyrics-sync-controls button strong {
  align-self: start;
  font-size: 11px;
  font-weight: 560;
}
</style>
