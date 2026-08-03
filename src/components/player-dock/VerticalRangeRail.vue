<script setup lang="ts">
defineProps<{
  label: string;
  max: number;
  min: number;
  percent: number;
  step: number;
  value: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

function changeValue(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="vertical-range-rail" :style="{ '--vertical-range-percent': `${percent}%` }">
    <i aria-hidden="true"></i>
    <input
      class="vertical-range-input"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      :aria-label="label"
      orient="vertical"
      @input="changeValue"
    />
  </div>
</template>

<style scoped>
.vertical-range-rail {
  position: relative;
  width: 18px;
  height: 76px;
}

.vertical-range-rail::before,
.vertical-range-rail::after {
  position: absolute;
  left: 50%;
  width: 4px;
  border-radius: 999px;
  content: "";
  pointer-events: none;
  transform: translateX(-50%);
}

.vertical-range-rail::before {
  inset-block: 0;
  background: var(--smw-volume-track);
}

.vertical-range-rail::after {
  bottom: 0;
  height: var(--vertical-range-percent);
  background: var(--smw-volume-fill);
  transition: height 80ms linear;
}

.vertical-range-rail i {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: var(--vertical-range-percent);
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--smw-volume-thumb);
  transform: translate(-50%, 50%);
  transition: bottom 80ms linear;
}

.vertical-range-input {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 76px;
  height: 18px;
  margin: 29px 0 0 -29px;
  opacity: 0;
  cursor: pointer;
  transform: rotate(-90deg);
  accent-color: var(--smw-text-primary);
}

.vertical-range-input::-webkit-slider-runnable-track,
.vertical-range-input::-webkit-slider-thumb,
.vertical-range-input::-moz-range-track,
.vertical-range-input::-moz-range-progress,
.vertical-range-input::-moz-range-thumb {
  opacity: 0;
}
</style>
