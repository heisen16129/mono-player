<script setup lang="ts">
import { Search } from '@lucide/vue';

defineProps<{
  modelValue: string;
  placeholder: string;
}>();

defineEmits<{
  submit: [value: string];
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <form class="discover-search" @submit.prevent="$emit('submit', modelValue.trim())">
    <Search :size="24" />
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <kbd>Enter</kbd>
  </form>
</template>

<style scoped>
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
  color: var(--smw-icon-muted);
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  box-shadow: 0 20px 60px color-mix(in srgb, var(--smw-button-primary) 10%, transparent);
}

.discover-search svg {
  color: var(--smw-icon-muted);
}

.discover-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  box-shadow: none;
  color: var(--smw-text-primary);
  background: transparent;
  font: inherit;
  font-size: 22px;
}

.discover-search input:focus,
.discover-search input:focus-visible {
  box-shadow: none;
}

.discover-search input::placeholder {
  color: var(--smw-text-muted);
}

.discover-search input::-webkit-search-cancel-button,
.discover-search input::-webkit-search-decoration {
  appearance: none;
}

.discover-search kbd {
  display: inline-grid;
  min-width: 58px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  font-family: inherit;
  font-size: 13px;
  font-weight: 520;
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

  .discover-search kbd {
    display: none;
  }
}
</style>
