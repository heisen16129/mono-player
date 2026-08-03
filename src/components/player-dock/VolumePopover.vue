<script setup lang="ts">
import VerticalRangeRail from './VerticalRangeRail.vue';

defineProps<{
  isMuted: boolean;
  volume: number;
  volumeLabel: string;
}>();

defineEmits<{
  change: [value: number];
}>();
</script>

<template>
  <div class="volume-popover" @click.stop @pointerdown.stop>
    <VerticalRangeRail :label="volumeLabel" :max="100" :min="0" :percent="isMuted ? 0 : volume" :step="1" :value="isMuted ? 0 : volume" @change="$emit('change', $event)" />
    <span>{{ isMuted ? 0 : volume }}%</span>
  </div>
</template>

<style scoped>
.volume-popover {
  position: absolute;
  left: 50%;
  bottom: 26px;
  z-index: 42;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 38px;
  height: 132px;
  padding: 12px 0 8px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 2px;
  color: var(--smw-volume-fill);
  background: var(--smw-player-bg);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.volume-popover span {
  color: var(--smw-volume-text);
  font-size: 11px;
  line-height: 1;
}
</style>
