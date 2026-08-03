<script setup lang="ts">
defineProps<{
  disabled: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button class="secondary-button compact" type="button" :disabled="disabled" @click="emit('click')">
    <slot />
  </button>
</template>
