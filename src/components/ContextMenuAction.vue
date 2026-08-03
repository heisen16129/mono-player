<script setup lang="ts">
withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <button type="button" role="menuitem" :disabled="disabled" @click="emit('action')">
    <slot />
  </button>
</template>
