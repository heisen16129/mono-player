<script setup lang="ts">
defineProps<{
  label: string;
  value: number;
}>();

const emit = defineEmits<{
  change: [];
  input: [event: Event];
}>();
</script>

<template>
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
</template>

<style scoped>
.dock-progress {
  position: absolute;
  z-index: 36;
  top: -7px;
  left: 0;
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
}

.dock-progress::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border: 2px solid var(--smw-progress-thumb-border);
  border-radius: 50%;
  background: var(--smw-progress-thumb);
  box-shadow: 0 0 0 1px var(--smw-progress-thumb-ring);
  appearance: none;
}

.dock-progress::-moz-range-track {
  height: 2px;
  border-radius: 999px;
  background: var(--smw-progress-track);
}

.dock-progress::-moz-range-progress {
  height: 2px;
  border-radius: 999px;
  background: var(--smw-progress-fill);
}

.dock-progress::-moz-range-thumb {
  width: 8px;
  height: 8px;
  border: 2px solid var(--smw-progress-thumb-border);
  border-radius: 50%;
  background: var(--smw-progress-thumb);
}
</style>
