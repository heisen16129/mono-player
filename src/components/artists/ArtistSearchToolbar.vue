<script setup lang="ts">
import { ref, watch } from 'vue';
import SearchInput from '../SearchInput.vue';

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
  <header class="artist-search-toolbar">
    <SearchInput :model-value="draftQuery" :placeholder="placeholder" @update:model-value="draftQuery = $event" @submit="submitSearch" />
  </header>
</template>

<style scoped>
.artist-search-toolbar {
  min-height: 40px;
}
</style>
