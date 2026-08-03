<script setup lang="ts">
defineProps<{
  label: string;
  value: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

function setValue(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <label class="cache-size-field">
    <span>{{ label }}</span>
    <input
      type="number"
      min="64"
      max="51200"
      step="64"
      :value="value"
      @change="setValue"
    />
  </label>
</template>

<style scoped>
.cache-size-field {
  display: grid;
  grid-template-columns: auto 132px;
  gap: 8px;
  align-items: center;
  color: var(--smw-text-body);
  font-size: 13px;
}

.cache-size-field input {
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

.cache-size-field input:hover {
  border-color: var(--smw-text-muted);
}

.cache-size-field input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}
</style>
