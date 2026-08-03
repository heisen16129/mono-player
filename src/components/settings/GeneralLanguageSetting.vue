<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

defineProps<{
  locale: Locale;
}>();

const emit = defineEmits<{
  setLocale: [locale: Locale];
}>();

function setLocale(event: Event) {
  emit('setLocale', (event.target as HTMLSelectElement).value as Locale);
}
</script>

<template>
  <label class="field-row">
    <span>{{ t(locale, 'language') }}</span>
    <select :value="locale" @change="setLocale">
      <option value="system">{{ t(locale, 'autoLanguage') }}</option>
      <option value="zh-CN">zh-CN</option>
      <option value="en-US">en-US</option>
    </select>
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

.field-row select {
  height: 36px;
  min-width: 0;
  padding: 0 38px 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background:
    linear-gradient(45deg, transparent 50%, var(--smw-text-secondary) 50%) calc(100% - 17px) 15px / 6px 6px no-repeat,
    linear-gradient(135deg, var(--smw-text-secondary) 50%, transparent 50%) calc(100% - 12px) 15px / 6px 6px no-repeat,
    var(--smw-bg-input);
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.field-row select:hover {
  border-color: var(--smw-text-muted);
}

.field-row select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}
</style>
