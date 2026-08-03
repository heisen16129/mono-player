<script setup lang="ts">
import { Timer } from '@lucide/vue';

defineProps<{
  isActive: boolean;
  isPaused: boolean;
  remainingLabel: string;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <button
    class="sleep-timer-button"
    :class="{ 'is-active': isActive || isPaused }"
    type="button"
    :aria-label="isActive ? `定时关闭剩余 ${remainingLabel}` : '定时关闭'"
    :title="isActive ? `定时关闭剩余 ${remainingLabel}` : '定时关闭'"
    @click="emit('toggle')"
  >
    <Timer :size="18" />
    <span v-if="isActive || isPaused">{{ remainingLabel }}</span>
  </button>
</template>

<style scoped>
.sleep-timer-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.sleep-timer-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.sleep-timer-button:hover,
.sleep-timer-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.sleep-timer-button.is-active {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 12%, transparent);
}

.sleep-timer-button.is-active span {
  font-weight: 650;
}
</style>
