<script setup lang="ts">
defineProps<{
  hours: number;
  minutes: number;
}>();

const emit = defineEmits<{
  setHours: [value: number];
  setMinutes: [value: number];
}>();

function updateHours(event: Event) {
  emit('setHours', Number((event.target as HTMLInputElement).value));
}

function updateMinutes(event: Event) {
  emit('setMinutes', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="sleep-timer-custom-time">
    <label>
      <input :value="hours" type="number" min="0" max="99" step="1" @input="updateHours" />
      <span>小时</span>
    </label>
    <label>
      <input :value="minutes" type="number" min="0" max="59" step="1" @input="updateMinutes" />
      <span>分钟</span>
    </label>
  </div>
</template>

<style scoped>
.sleep-timer-custom-time {
  display: grid;
  grid-template-columns: max-content max-content;
  gap: 18px;
}

.sleep-timer-custom-time label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.sleep-timer-custom-time input {
  width: 64px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-weight: 650;
  text-align: center;
}

.sleep-timer-custom-time input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
