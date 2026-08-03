<script setup lang="ts">
import SearchInput from '../SearchInput.vue';

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
  <SearchInput
    :model-value="modelValue"
    root-class="lyrics-search-input"
    :placeholder="placeholder"
    @update:model-value="$emit('update:modelValue', $event)"
    @submit="$emit('submit', $event)"
  />
</template>
