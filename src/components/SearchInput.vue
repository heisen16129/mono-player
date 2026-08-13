<script setup lang="ts">
import { Search } from '@lucide/vue';
import { ref } from 'vue';
import SearchEnterHint from './SearchEnterHint.vue';
import DiscoverSearchHistoryPopover from './DiscoverSearchHistoryPopover.vue';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  enterHint?: string;
  iconSize?: number;
  modelValue: string;
  placeholder: string;
  rootClass?: string;
  searchHistory?: string[];
  showEnterHint?: boolean;
}>(), {
  disabled: false,
  enterHint: '',
  iconSize: 16,
  rootClass: 'search-field top-search',
  searchHistory: () => [],
  showEnterHint: false,
});

const emit = defineEmits<{
  'clear-search-history': [];
  'remove-search-history': [keyword: string];
  submit: [value: string];
  'update:modelValue': [value: string];
}>();

const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const isHistoryOpen = ref(false);

function focusInput() {
  inputRef.value?.focus();
}

function openHistory() {
  if (props.searchHistory.length > 0) {
    isHistoryOpen.value = true;
  }
}

function closeHistory() {
  isHistoryOpen.value = false;
}

function handleFocus() {
  openHistory();
}

function handleBlur(event: FocusEvent) {
  const nextTarget = event.relatedTarget as Node | null;
  if (nextTarget && rootRef.value?.contains(nextTarget)) return;
  window.setTimeout(() => {
    const activeElement = document.activeElement;
    if (activeElement && rootRef.value?.contains(activeElement)) return;
    closeHistory();
  }, 0);
}

function submitSearch() {
  closeHistory();
  emit('submit', props.modelValue.trim());
}

function submitHistorySearch(keyword: string) {
  closeHistory();
  emit('submit', keyword.trim());
}

function clearHistory() {
  emit('clear-search-history');
  closeHistory();
}

function removeHistory(keyword: string) {
  emit('remove-search-history', keyword);
}

defineExpose({
  focusInput,
});
</script>

<template>
  <div
    ref="rootRef"
    class="search-input-shell"
    :class="{ 'search-input-shell--history': searchHistory.length > 0 }"
  >
    <form :class="rootClass" @pointerdown="focusInput" @submit.prevent="submitSearch">
      <Search :size="iconSize" />
      <input
        ref="inputRef"
        :value="modelValue"
        type="search"
        :disabled="disabled"
        :placeholder="placeholder"
        @blur="handleBlur"
        @focus="handleFocus"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <SearchEnterHint v-if="showEnterHint" :hint="enterHint" />
      <slot name="after" />
    </form>

    <DiscoverSearchHistoryPopover
      :history="searchHistory"
      :visible="isHistoryOpen && searchHistory.length > 0"
      @clear="clearHistory"
      @close="closeHistory"
      @remove="removeHistory"
      @search="submitHistorySearch"
    />
  </div>
</template>

<style scoped>
.search-input-shell {
  position: relative;
  width: 100%;
  min-width: 0;
}

.search-input-shell--history {
  width: fit-content;
}

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
  flex: 1 1 auto;
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
  flex: 1 1 auto;
  width: 100%;
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
