<script setup lang="ts">
import { ref, watch } from 'vue';
import SearchInput from './SearchInput.vue';

const props = defineProps<{
  modelValue: string;
  placeholder: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
const draftQuery = ref(props.modelValue);
watch(() => props.modelValue, value => { draftQuery.value = value; });

function submitSearch(value: string) {
  draftQuery.value = value;
  emit('update:modelValue', value);
}
</script>

<template>
  <header class="workspace-toolbar">
    <SearchInput :model-value="draftQuery" :placeholder="placeholder" @update:model-value="draftQuery = $event" @submit="submitSearch" />
  </header>
</template>

<style scoped>
.workspace-toolbar {
  min-height: 40px;
  padding-inline: 24px;
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
