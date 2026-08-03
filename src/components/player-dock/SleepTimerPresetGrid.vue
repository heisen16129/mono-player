<script setup lang="ts">
defineProps<{
  hours: number;
  minutes: number;
  presetMinutes: readonly number[];
}>();

const emit = defineEmits<{
  setPreset: [minutes: number];
}>();
</script>

<template>
  <div class="sleep-timer-presets">
    <button
      v-for="preset in presetMinutes"
      :key="preset"
      type="button"
      :class="{ 'is-active': hours * 60 + minutes === preset }"
      @click="emit('setPreset', preset)"
    >
      <strong>{{ preset }}</strong>
      <span>分钟</span>
    </button>
  </div>
</template>

<style scoped>
.sleep-timer-presets {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.sleep-timer-presets button {
  display: grid;
  min-height: 50px;
  place-items: center;
  padding: 6px 0;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.sleep-timer-presets strong {
  font-size: 15px;
  font-weight: 650;
}

.sleep-timer-presets button.is-active {
  color: #fff;
  border-color: var(--smw-button-primary);
  background: var(--smw-button-primary);
}

.sleep-timer-presets span {
  color: currentColor;
  font-size: 12px;
  opacity: 0.76;
}
</style>
