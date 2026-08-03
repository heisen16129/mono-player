<script setup lang="ts">
withDefaults(defineProps<{
  autocomplete?: string;
  inputmode?: 'numeric';
  label: string;
  max?: string;
  min?: string;
  placeholder: string;
  required?: boolean;
  type?: 'number' | 'text';
  value: string;
}>(), {
  autocomplete: 'off',
  inputmode: undefined,
  max: undefined,
  min: undefined,
  required: false,
  type: 'text',
});

const emit = defineEmits<{
  update: [value: string];
}>();

function inputValue(event: Event) {
  emit('update', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <label class="metadata-field">
    <span>{{ label }}</span>
    <input
      :value="value"
      :type="type"
      :inputmode="inputmode"
      :min="min"
      :max="max"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :required="required"
      @input="inputValue"
    />
  </label>
</template>

<style scoped>
.metadata-field {
  display: grid;
  gap: 6px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.metadata-field input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  outline: none;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font: inherit;
}

.metadata-field input:focus {
  border-color: var(--smw-border-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
}
</style>
