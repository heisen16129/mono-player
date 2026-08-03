<script setup lang="ts">
defineProps<{
  active: boolean;
  label: string;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <button
    class="icon-button"
    :class="{ 'is-active': active }"
    type="button"
    :aria-label="label"
    :title="label"
    @click="emit('action')"
  >
    <slot name="icon" />
  </button>
</template>

<style scoped>
.icon-button.is-active {
  background: var(--smw-bg-selected);
}
</style>
