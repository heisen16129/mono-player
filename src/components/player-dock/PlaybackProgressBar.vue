<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatDuration } from '../../utils/format';

const props = defineProps<{
  duration: number;
  label: string;
  value: number;
}>();

const emit = defineEmits<{
  change: [];
  input: [event: Event];
}>();

const hoverPercent = ref(0);
const hovering = ref(false);

const previewLabel = computed(() => formatDuration((props.duration || 0) * hoverPercent.value / 100));
const showPreview = computed(() => hovering.value && props.duration > 0);

function updateHoverPosition(event: MouseEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (bounds.width <= 0) return;
  hoverPercent.value = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
}

function handleMouseEnter(event: MouseEvent) {
  hovering.value = true;
  updateHoverPosition(event);
}

function handleMouseLeave() {
  hovering.value = false;
}
</script>

<template>
  <div
    class="dock-progress-wrap"
    :style="{ '--hover-percent': `${hoverPercent}%` }"
    @mouseenter="handleMouseEnter"
    @mousemove="updateHoverPosition"
    @mouseleave="handleMouseLeave"
  >
    <input
      class="dock-progress"
      type="range"
      min="0"
      max="100"
      step="0.01"
      :value="value"
      :style="{ '--progress-percent': `${value}%` }"
      :aria-label="label"
      @input="emit('input', $event)"
      @change="emit('change')"
    />
    <span v-if="showPreview" class="dock-progress-preview">{{ previewLabel }}</span>
  </div>
</template>

<style scoped>
.dock-progress-wrap {
  position: absolute;
  z-index: 36;
  top: -7px;
  left: 0;
  width: 100%;
  height: 14px;
}

.dock-progress {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
  accent-color: var(--smw-progress-fill);
}

.dock-progress::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--smw-progress-fill) 0 var(--progress-percent),
    var(--smw-progress-track) var(--progress-percent) 100%
  );
  transition: height 140ms ease;
}

.dock-progress-wrap:hover .dock-progress::-webkit-slider-runnable-track,
.dock-progress:focus-visible::-webkit-slider-runnable-track {
  height: 4px;
}

.dock-progress::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border: 2px solid var(--smw-progress-thumb-border);
  border-radius: 50%;
  background: var(--smw-progress-thumb);
  box-shadow: 0 0 0 1px var(--smw-progress-thumb-ring);
  opacity: 0;
  transition: opacity 120ms ease;
  appearance: none;
}

.dock-progress:hover::-webkit-slider-thumb,
.dock-progress:focus-visible::-webkit-slider-thumb {
  opacity: 1;
}

.dock-progress-wrap:hover .dock-progress::-webkit-slider-thumb,
.dock-progress:focus-visible::-webkit-slider-thumb {
  margin-top: -3px;
}

.dock-progress::-moz-range-track {
  height: 2px;
  border-radius: 999px;
  background: var(--smw-progress-track);
  transition: height 140ms ease;
}

.dock-progress::-moz-range-progress {
  height: 2px;
  border-radius: 999px;
  background: var(--smw-progress-fill);
  transition: height 140ms ease;
}

.dock-progress-wrap:hover .dock-progress::-moz-range-track,
.dock-progress-wrap:hover .dock-progress::-moz-range-progress,
.dock-progress:focus-visible::-moz-range-track,
.dock-progress:focus-visible::-moz-range-progress {
  height: 4px;
}

.dock-progress::-moz-range-thumb {
  width: 8px;
  height: 8px;
  border: 2px solid var(--smw-progress-thumb-border);
  border-radius: 50%;
  background: var(--smw-progress-thumb);
  opacity: 0;
  transition: opacity 120ms ease;
}

.dock-progress:hover::-moz-range-thumb,
.dock-progress:focus-visible::-moz-range-thumb {
  opacity: 1;
}

.dock-progress-preview {
  position: absolute;
  bottom: calc(100% + 4px);
  left: clamp(24px, var(--hover-percent), calc(100% - 24px));
  transform: translateX(-50%);
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(20, 22, 27, 0.88);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  pointer-events: none;
  white-space: nowrap;
}
</style>
