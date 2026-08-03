<script setup lang="ts">
defineProps<{
  minutes: number;
}>();

const emit = defineEmits<{
  setMinutes: [value: number];
}>();

function setMinutes(event: Event) {
  emit('setMinutes', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <label class="field-row">
    <span>定时关闭默认时间</span>
    <span class="number-field">
      <input
        type="number"
        min="1"
        max="999"
        step="1"
        :value="minutes"
        aria-label="定时关闭默认分钟数"
        @change="setMinutes"
      />
      <small>分钟</small>
    </span>
  </label>
</template>

<style scoped>
.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.number-field {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.number-field input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.number-field input:hover {
  border-color: var(--smw-text-muted);
}

.number-field input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.number-field small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
