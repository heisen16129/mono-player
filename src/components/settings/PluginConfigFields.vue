<script setup lang="ts">
import type { PluginConfig, PluginConfigField } from '../../types/plugin';

const props = defineProps<{
  config: PluginConfig;
  fields: PluginConfigField[];
  locale: string;
  scopeId: string;
}>();

const emit = defineEmits<{
  update: [config: PluginConfig];
}>();

function defaultFieldValue(field: PluginConfigField) {
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue;
  if (field.type === 'checkbox') return [];
  if (field.type === 'switch') return false;
  return '';
}

function fieldValue(field: PluginConfigField) {
  return props.config[field.key] ?? defaultFieldValue(field);
}

function textFieldValue(field: PluginConfigField) {
  const value = fieldValue(field);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function booleanFieldValue(field: PluginConfigField) {
  return fieldValue(field) === true;
}

function checkboxFieldValue(field: PluginConfigField) {
  const value = fieldValue(field);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function setFieldValue(field: PluginConfigField, value: PluginConfig[string]) {
  const nextConfig = { ...props.config };
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    delete nextConfig[field.key];
  } else {
    nextConfig[field.key] = value;
  }
  emit('update', nextConfig);
}

function setTextField(field: PluginConfigField, event: Event) {
  setFieldValue(field, (event.target as HTMLInputElement | HTMLSelectElement).value.trim());
}

function setNumberField(field: PluginConfigField, event: Event) {
  const value = (event.target as HTMLInputElement).value.trim();
  const numberValue = Number(value);
  setFieldValue(field, value && Number.isFinite(numberValue) ? numberValue : undefined);
}

function setSwitchField(field: PluginConfigField, event: Event) {
  setFieldValue(field, (event.target as HTMLInputElement).checked);
}

function setCheckboxField(field: PluginConfigField, optionValue: string, event: Event) {
  const selectedValues = new Set(checkboxFieldValue(field));
  if ((event.target as HTMLInputElement).checked) {
    selectedValues.add(optionValue);
  } else {
    selectedValues.delete(optionValue);
  }
  setFieldValue(field, [...selectedValues]);
}
</script>

<template>
  <div v-for="field in fields" :key="field.key" class="plugin-field-row">
    <span>{{ locale === 'en-US' ? (field.labelEn ?? field.label) : field.label }}</span>

    <input
      v-if="field.type === 'text' || field.type === 'password'"
      :type="field.type"
      autocomplete="off"
      :value="textFieldValue(field)"
      :placeholder="field.placeholder ?? ''"
      @change="setTextField(field, $event)"
    />

    <input
      v-else-if="field.type === 'number'"
      type="number"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :value="textFieldValue(field)"
      :placeholder="field.placeholder ?? ''"
      @input="setNumberField(field, $event)"
    />

    <div v-else-if="field.type === 'range'" class="range-field">
      <input
        type="range"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :value="textFieldValue(field)"
        @input="setNumberField(field, $event)"
      />
      <output>{{ textFieldValue(field) }}</output>
    </div>

    <select
      v-else-if="field.type === 'select'"
      :value="textFieldValue(field)"
      @change="setTextField(field, $event)"
    >
      <option value="">{{ field.placeholder ?? (locale === 'en-US' ? 'Select' : '请选择') }}</option>
      <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>

    <div v-else-if="field.type === 'radio'" class="inline-options">
      <label v-for="option in field.options ?? []" :key="option.value" class="option-row">
        <input
          type="radio"
          :name="`${scopeId}-${field.key}`"
          :value="option.value"
          :checked="textFieldValue(field) === option.value"
          @change="setTextField(field, $event)"
        />{{ option.label }}
      </label>
    </div>

    <div v-else-if="field.type === 'checkbox'" class="inline-options">
      <label v-for="option in field.options ?? []" :key="option.value" class="option-row">
        <input
          type="checkbox"
          :value="option.value"
          :checked="checkboxFieldValue(field).includes(option.value)"
          @change="setCheckboxField(field, option.value, $event)"
        />{{ option.label }}
      </label>
    </div>

    <label v-else-if="field.type === 'switch'" class="option-row">
      <input
        type="checkbox"
        :checked="booleanFieldValue(field)"
        @change="setSwitchField(field, $event)"
      />{{ locale === 'en-US' ? 'Enabled' : '启用' }}
    </label>
  </div>
</template>

<style scoped>
.plugin-field-row {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 320px);
  gap: 10px;
  align-items: center;
  max-width: 560px;
  color: var(--smw-text-body);
  font-size: 13px;
}

.plugin-field-row > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-field-row input[type="text"],
.plugin-field-row input[type="password"],
.plugin-field-row input[type="number"],
.plugin-field-row select {
  height: 34px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
}

.plugin-field-row input:focus,
.plugin-field-row select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.inline-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  min-width: 0;
}

.range-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.range-field input {
  width: 100%;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

.range-field output {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
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

.option-row input[type="checkbox"],
.option-row input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

@media (max-width: 720px) {
  .plugin-field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
