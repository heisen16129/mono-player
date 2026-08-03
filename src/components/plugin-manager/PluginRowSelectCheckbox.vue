<script setup lang="ts">
defineProps<{
  pluginName: string;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [selected: boolean];
}>();
</script>

<template>
  <input
    type="checkbox"
    :checked="selected"
    :aria-label="`选择 ${pluginName}`"
    @change="emit('select', ($event.target as HTMLInputElement).checked)"
  />
</template>

<style scoped>
input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--smw-button-primary);
}
</style>
