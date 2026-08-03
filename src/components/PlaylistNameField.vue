<script setup lang="ts">
defineProps<{
  label: string;
  name: string;
  placeholder: string;
}>();

const emit = defineEmits<{
  'update:name': [value: string];
}>();
</script>

<template>
  <label class="playlist-name-field">
    <span>{{ label }}</span>
    <input
      :value="name"
      type="text"
      :placeholder="placeholder"
      @input="emit('update:name', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>

<style scoped>
.playlist-name-field {
  display: grid;
  gap: 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.playlist-name-field input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  outline: none;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font: inherit;
}

.playlist-name-field input:focus {
  border-color: var(--smw-border-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
}
</style>
