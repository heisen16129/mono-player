<script setup lang="ts">
defineProps<{
  chooseLabel: string;
  defaultLabel: string;
  systemTempLabel: string;
}>();

const emit = defineEmits<{
  choose: [];
  useDefault: [];
  useSystemTemp: [];
}>();
</script>

<template>
  <button class="secondary-button compact" type="button" @click="emit('useSystemTemp')">
    {{ systemTempLabel }}
  </button>
  <button class="secondary-button compact" type="button" @click="emit('useDefault')">
    {{ defaultLabel }}
  </button>
  <button class="secondary-button compact" type="button" @click="emit('choose')">
    {{ chooseLabel }}
  </button>
</template>

<style scoped>
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
