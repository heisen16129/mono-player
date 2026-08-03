<script setup lang="ts">
defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <span class="cache-actions">
    <button class="secondary-button compact" type="button" @click="emit('clear')">
      {{ label }}
    </button>
  </span>
</template>

<style scoped>
.cache-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.secondary-button.compact:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, var(--smw-bg-input));
}

.secondary-button.compact:focus-visible {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
