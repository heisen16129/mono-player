<script setup lang="ts">
import { Search } from '@lucide/vue';

withDefaults(defineProps<{
  disabled?: boolean;
  enterHint?: string;
  iconSize?: number;
  modelValue: string;
  placeholder: string;
  rootClass?: string;
  showEnterHint?: boolean;
}>(), {
  disabled: false,
  enterHint: '',
  iconSize: 16,
  rootClass: 'search-field top-search',
  showEnterHint: false,
});

defineEmits<{
  submit: [value: string];
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <form :class="rootClass" @submit.prevent="$emit('submit', modelValue.trim())">
    <Search :size="iconSize" />
    <input
      :value="modelValue"
      type="search"
      :disabled="disabled"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="showEnterHint" class="enter-hint"><kbd>Enter</kbd><span>{{ enterHint }}</span></span>
    <slot name="after" />
  </form>
</template>

<style scoped>
.result-search {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  width: min(320px, 34vw);
  height: 42px;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
}

.discover-search {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  width: min(760px, 100%);
  height: 76px;
  gap: 14px;
  padding: 0 26px;
  border: 1px solid color-mix(in srgb, var(--smw-button-primary) 28%, var(--smw-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  box-shadow: 0 20px 60px color-mix(in srgb, var(--smw-button-primary) 10%, transparent);
}

.lyrics-search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-input);
}

.result-search svg,
.discover-search svg,
.lyrics-search-field svg {
  color: var(--smw-icon-muted);
}

.result-search input,
.discover-search input,
.lyrics-search-field input {
  min-width: 0;
  border: 0;
  outline: 0;
  box-shadow: none;
  color: var(--smw-text-primary);
  background: transparent;
  font: inherit;
}

.result-search input,
.lyrics-search-field input {
  font-size: 14px;
}

.discover-search input {
  font-size: 22px;
}

.result-search input:focus,
.result-search input:focus-visible,
.discover-search input:focus,
.discover-search input:focus-visible,
.lyrics-search-field input:focus,
.lyrics-search-field input:focus-visible {
  box-shadow: none;
}

.result-search input::placeholder,
.discover-search input::placeholder,
.lyrics-search-field input::placeholder {
  color: var(--smw-text-muted);
}

.enter-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.enter-hint kbd,
.discover-search :deep(kbd) {
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--smw-border);
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  font-family: inherit;
  font-weight: 520;
}

.enter-hint kbd {
  min-width: 42px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
}

.discover-search :deep(kbd) {
  min-width: 58px;
  height: 28px;
  border-radius: 7px;
  font-size: 13px;
}

@media (max-width: 980px) {
  .enter-hint span {
    display: none;
  }

  .result-search {
    width: min(320px, 100%);
  }
}

@media (max-width: 820px) {
  .discover-search {
    height: auto;
    min-height: 64px;
    padding: 0 18px;
  }

  .discover-search input {
    font-size: 18px;
  }

  .discover-search :deep(kbd) {
    display: none;
  }
}
</style>
