<script setup lang="ts">
import { ref } from 'vue';
import { Volume2 } from '@lucide/vue';

defineProps<{
  isMuted: boolean;
  muteLabel: string;
  restoreLabel: string;
  volume: number;
  volumeLabel: string;
}>();

const emit = defineEmits<{
  change: [value: number];
  toggleMute: [];
}>();

const volumeControl = ref<HTMLElement | null>(null);

function closeVolumePopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && volumeControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function changeVolume(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div ref="volumeControl" class="volume-control" @mouseleave="closeVolumePopover">
    <div class="volume-popover">
      <div class="volume-rail" :style="{ '--volume-percent': `${isMuted ? 0 : volume}%` }">
        <i aria-hidden="true"></i>
        <input
          class="volume vertical"
          type="range"
          min="0"
          max="100"
          step="1"
          :value="isMuted ? 0 : volume"
          :aria-label="volumeLabel"
          orient="vertical"
          @input="changeVolume"
        />
      </div>
      <span>{{ isMuted ? 0 : volume }}%</span>
    </div>
    <button
      class="icon-button volume-button"
      type="button"
      :aria-label="isMuted ? restoreLabel : muteLabel"
      :title="isMuted ? restoreLabel : muteLabel"
      @click="emit('toggleMute')"
    >
      <Volume2 :size="18" />
    </button>
  </div>
</template>

<style scoped>
.volume {
  accent-color: var(--smw-text-primary);
}

.volume-control {
  position: relative;
  display: grid;
  place-items: center;
}

.volume-control::before {
  position: absolute;
  left: 50%;
  bottom: 24px;
  width: 54px;
  height: 24px;
  content: "";
  transform: translateX(-50%);
}

.volume-button {
  color: var(--smw-text-body);
}

.volume-button:hover,
.volume-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.volume-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.volume-popover {
  position: absolute;
  left: 50%;
  bottom: 34px;
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
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.volume-control:hover .volume-popover,
.volume-control:focus-within .volume-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.volume-rail {
  position: relative;
  width: 18px;
  height: 76px;
}

.volume-rail::before,
.volume-rail::after {
  position: absolute;
  left: 50%;
  width: 4px;
  border-radius: 999px;
  content: "";
  pointer-events: none;
  transform: translateX(-50%);
}

.volume-rail::before {
  inset-block: 0;
  background: var(--smw-volume-track);
}

.volume-rail::after {
  bottom: 0;
  height: var(--volume-percent);
  background: var(--smw-volume-fill);
  transition: height 80ms linear;
}

.volume-rail i {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: var(--volume-percent);
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--smw-volume-thumb);
  transform: translate(-50%, 50%);
  transition: bottom 80ms linear;
}

.volume-rail .volume.vertical {
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

.volume-rail .volume.vertical::-webkit-slider-runnable-track,
.volume-rail .volume.vertical::-webkit-slider-thumb,
.volume-rail .volume.vertical::-moz-range-track,
.volume-rail .volume.vertical::-moz-range-progress,
.volume-rail .volume.vertical::-moz-range-thumb {
  opacity: 0;
}

.volume-popover span {
  color: var(--smw-volume-text);
  font-size: 11px;
  line-height: 1;
}
</style>
