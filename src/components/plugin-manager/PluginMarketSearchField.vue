<script setup lang="ts">
import { Search } from '@lucide/vue';

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label class="plugin-market-search">
    <Search :size="16" />
    <input
      :value="modelValue"
      type="search"
      placeholder="搜索插件、作者、能力"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>

<style scoped>
.plugin-market-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  min-width: 0;
  padding: 0 11px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
}

.plugin-market-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  outline: none;
}
</style>
