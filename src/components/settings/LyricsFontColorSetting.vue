<script setup lang="ts">
defineProps<{
  color: string;
  label: string;
  useThemeColor: boolean;
  useThemeColorLabel: string;
}>();

const emit = defineEmits<{
  setColor: [value: string];
  setUseThemeColor: [value: boolean];
}>();
</script>

<template>
  <label class="field-row">
    <span>{{ label }}</span>
    <label class="option-row">
      <input
        type="checkbox"
        :checked="useThemeColor"
        @change="emit('setUseThemeColor', ($event.target as HTMLInputElement).checked)"
      />
      {{ useThemeColorLabel }}
    </label>
    <span class="color-field">
      <input
        v-if="!useThemeColor"
        type="color"
        :value="color"
        :aria-label="label"
        @input="emit('setColor', ($event.target as HTMLInputElement).value)"
      />
      <small v-if="!useThemeColor">{{ color }}</small>
    </span>
  </label>
</template>

<style scoped>
.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.field-row > span:first-child {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.option-row {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  color: var(--smw-text-body);
  font-size: 14px;
  line-height: 1.2;
}

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

.color-field {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 28px;
}

.color-field input {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.color-field input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-field input::-webkit-color-swatch {
  border: 0;
  border-radius: 2px;
}

.color-field small {
  color: var(--smw-text-body);
  font-size: 13px;
}
</style>
