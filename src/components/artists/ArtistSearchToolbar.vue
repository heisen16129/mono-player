<script setup lang="ts">
import SearchInput from '../SearchInput.vue';

defineProps<{
  modelValue: string;
  placeholder: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <header class="artist-search-toolbar">
    <SearchInput :model-value="modelValue" :placeholder="placeholder" @update:model-value="emit('update:modelValue', $event)" />
  </header>
</template>

<style scoped>
.artist-search-toolbar {
  min-height: 40px;
}
</style>
