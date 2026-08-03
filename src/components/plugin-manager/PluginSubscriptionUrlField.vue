<script setup lang="ts">
defineProps<{
  disabled: boolean;
  modelValue: string;
}>();

const emit = defineEmits<{
  add: [];
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label>
    <span>订阅地址</span>
    <input
      :value="modelValue"
      type="url"
      :disabled="disabled"
      placeholder="https://example.com/plugins.json 或 plugin.wasm"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="emit('add')"
    />
  </label>
</template>

<style scoped>
label {
  display: grid;
  gap: 8px;
}

label > span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-weight: 560;
}

input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
}

input:focus {
  border-color: var(--smw-text-primary);
  box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
}

input:disabled {
  cursor: wait;
  opacity: 0.72;
}
</style>
