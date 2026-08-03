<script setup lang="ts">
import VerticalRangeRail from './VerticalRangeRail.vue';

defineProps<{
  label: string;
  rate: number;
}>();

defineEmits<{
  change: [value: number];
}>();
</script>

<template>
  <div class="speed-popover" @click.stop @pointerdown.stop>
    <VerticalRangeRail :label="`播放速度 ${label}`" :max="2" :min="0.5" :percent="((rate - 0.5) / 1.5) * 100" :step="0.25" :value="rate" @change="$emit('change', $event)" />
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
.speed-popover {
  position: absolute;
  left: 50%;
  bottom: 26px;
  z-index: 42;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 42px;
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

.speed-popover span {
  color: var(--smw-volume-text);
  font-size: 11px;
  line-height: 1;
}
</style>
