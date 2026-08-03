<script setup lang="ts">
import SearchInput from '../SearchInput.vue';

defineOptions({ inheritAttrs: false });

defineProps<{
  enterHint: string;
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
    root-class="plugin-search-input"
    :placeholder="placeholder"
    :icon-size="20"
    show-enter-hint
    :enter-hint="enterHint"
    @update:model-value="$emit('update:modelValue', $event)"
    @submit="$emit('submit', $event)"
  />
</template>
