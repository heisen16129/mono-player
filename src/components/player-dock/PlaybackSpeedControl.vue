<script setup lang="ts">
import { ref } from 'vue';
import { Gauge } from '@lucide/vue';

defineProps<{
  label: string;
  rate: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

const speedControl = ref<HTMLElement | null>(null);

function closeSpeedPopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && speedControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function changePlaybackRate(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div ref="speedControl" class="speed-control" @mouseleave="closeSpeedPopover">
    <div class="speed-popover">
      <div class="speed-rail" :style="{ '--speed-percent': `${((rate - 0.5) / 1.5) * 100}%` }">
        <i aria-hidden="true"></i>
        <input
          class="speed vertical"
          type="range"
          min="0.5"
          max="2"
          step="0.25"
          :value="rate"
          :aria-label="`播放速度 ${label}`"
          orient="vertical"
          @input="changePlaybackRate"
        />
      </div>
      <span>{{ label }}</span>
    </div>
    <button class="icon-button speed-button" type="button" :aria-label="`播放速度 ${label}`" :title="`播放速度 ${label}`">
      <Gauge :size="18" />
    </button>
  </div>
</template>

<style scoped>
.speed-control {
  position: relative;
  display: grid;
  place-items: center;
}

.speed-control::before {
  position: absolute;
  left: 50%;
  bottom: 24px;
  width: 54px;
  height: 24px;
  content: "";
  transform: translateX(-50%);
}

.speed-button {
  color: var(--smw-text-body);
}

.speed-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.speed-button:hover,
.speed-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.speed-popover {
  position: absolute;
  left: 50%;
  bottom: 34px;
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
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.speed-control:hover .speed-popover,
.speed-control:focus-within .speed-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.speed-rail {
  position: relative;
  width: 18px;
  height: 76px;
}

.speed-rail::before,
.speed-rail::after {
  position: absolute;
  left: 50%;
  width: 4px;
  border-radius: 999px;
  content: "";
  pointer-events: none;
  transform: translateX(-50%);
}

.speed-rail::before {
  inset-block: 0;
  background: var(--smw-volume-track);
}

.speed-rail::after {
  bottom: 0;
  height: var(--speed-percent);
  background: var(--smw-volume-fill);
  transition: height 80ms linear;
}

.speed-rail i {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: var(--speed-percent);
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--smw-volume-thumb);
  transform: translate(-50%, 50%);
  transition: bottom 80ms linear;
}

.speed-rail .speed.vertical {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 76px;
  height: 18px;
  margin: 29px 0 0 -29px;
  opacity: 0;
  cursor: pointer;
  transform: rotate(-90deg);
}

.speed-rail .speed.vertical::-webkit-slider-runnable-track,
.speed-rail .speed.vertical::-webkit-slider-thumb,
.speed-rail .speed.vertical::-moz-range-track,
.speed-rail .speed.vertical::-moz-range-progress,
.speed-rail .speed.vertical::-moz-range-thumb {
  opacity: 0;
}

.speed-popover span {
  color: var(--smw-volume-text);
  font-size: 11px;
  line-height: 1;
}
</style>
