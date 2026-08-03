<script setup lang="ts">
defineProps<{
  checked: boolean;
  disabled: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <input type="checkbox" :checked="checked" :disabled="disabled" aria-label="选择全部插件" @change="$emit('toggle')" />
</template>

<style scoped>
input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--smw-button-primary);
}
</style>
