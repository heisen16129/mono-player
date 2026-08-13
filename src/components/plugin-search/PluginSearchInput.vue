<script setup lang="ts">
import SearchInput from '../SearchInput.vue';

defineOptions({ inheritAttrs: false });

defineProps<{
  enterHint: string;
  modelValue: string;
  placeholder: string;
  searchHistory: string[];
}>();

defineEmits<{
  clearSearchHistory: [];
  removeSearchHistory: [keyword: string];
  submit: [value: string];
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <SearchInput
    :model-value="modelValue"
    root-class="plugin-search-input"
    :placeholder="placeholder"
    :icon-size="20"
    :search-history="searchHistory"
    show-enter-hint
    :enter-hint="enterHint"
    @clear-search-history="$emit('clearSearchHistory')"
    @remove-search-history="$emit('removeSearchHistory', $event)"
    @update:model-value="$emit('update:modelValue', $event)"
    @submit="$emit('submit', $event)"
  />
</template>
