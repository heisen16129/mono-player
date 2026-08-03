<script setup lang="ts">
import SearchInput from './SearchInput.vue';

defineProps<{
  modelValue: string;
  placeholder: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <header class="workspace-toolbar">
    <SearchInput :model-value="modelValue" :placeholder="placeholder" @update:model-value="emit('update:modelValue', $event)" />
  </header>
</template>

<style scoped>
.workspace-toolbar {
  min-height: 40px;
}

@media (max-height: 760px) and (min-width: 821px) {
  .workspace-toolbar {
    min-height: 36px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .workspace-toolbar {
    min-height: 32px;
  }
}
</style>
