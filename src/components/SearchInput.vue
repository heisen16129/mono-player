<script setup lang="ts">
import { Search } from '@lucide/vue';
import SearchEnterHint from './SearchEnterHint.vue';

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
    <SearchEnterHint v-if="showEnterHint" :hint="enterHint" />
    <slot name="after" />
  </form>
</template>

<style scoped>
.search-field {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 42px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-input);
}

.search-field input {
  appearance: none;
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--smw-text-primary);
  background: transparent;
  font-size: 14px;
}

.search-field input::placeholder {
  color: var(--smw-text-secondary);
}

.search-field input:focus,
.search-field input:focus-visible {
  outline: 0;
  box-shadow: none;
}

.search-field input::-webkit-search-cancel-button,
.search-field input::-webkit-search-decoration,
.plugin-search-input input::-webkit-search-cancel-button,
.plugin-search-input input::-webkit-search-decoration,
.lyrics-search-input input::-webkit-search-cancel-button,
.lyrics-search-input input::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
}

.top-search {
  width: min(320px, 34vw);
}

.plugin-search-input {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  width: min(320px, 34vw);
  height: 42px;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-input);
}

.lyrics-search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-input);
}

.plugin-search-input svg,
.lyrics-search-input svg {
  color: var(--smw-icon-muted);
}

.plugin-search-input input,
.lyrics-search-input input {
  min-width: 0;
  border: 0;
  outline: 0;
  box-shadow: none;
  color: var(--smw-text-primary);
  background: transparent;
  font: inherit;
  font-size: 14px;
}

.plugin-search-input input:focus,
.plugin-search-input input:focus-visible,
.lyrics-search-input input:focus,
.lyrics-search-input input:focus-visible {
  box-shadow: none;
}

.plugin-search-input input::placeholder,
.lyrics-search-input input::placeholder {
  color: var(--smw-text-muted);
}

@media (max-width: 980px) {
  .plugin-search-input {
    width: min(320px, 100%);
  }
}

</style>
