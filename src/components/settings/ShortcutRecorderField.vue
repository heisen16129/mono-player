<script setup lang="ts">
import { RotateCcw, X } from '@lucide/vue';
import { computed } from 'vue';
import { shortcutFromKeyboardEvent } from '../../utils/shortcuts';

const emit = defineEmits<{
  change: [value: string];
  reset: [];
}>();

const props = defineProps<{
  disabled?: boolean;
  emptyLabel: string;
  hasConflict?: boolean;
  label: string;
  resetLabel: string;
  value: string;
}>();

const displayValue = computed(() => props.value || props.emptyLabel);
const isEmpty = computed(() => !props.value);

function captureShortcut(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    (event.currentTarget as HTMLInputElement).blur();
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    emit('change', '');
    return;
  }

  const shortcut = shortcutFromKeyboardEvent(event);
  if (shortcut) emit('change', shortcut);
}
</script>

<template>
  <span class="shortcut-recorder" :class="{ 'has-conflict': hasConflict, 'is-empty': isEmpty }">
    <input
      type="text"
      :aria-label="label"
      :disabled="disabled"
      :placeholder="disabled ? '' : label"
      readonly
      :value="displayValue"
      @keydown="captureShortcut"
    />
    <button class="shortcut-icon-button" type="button" :disabled="disabled || !value" :aria-label="label" @click="emit('change', '')">
      <X :size="14" />
    </button>
    <button class="shortcut-icon-button" type="button" :disabled="disabled" :aria-label="resetLabel" :title="resetLabel" @click="emit('reset')">
      <RotateCcw :size="14" />
    </button>
  </span>
</template>

<style scoped>
.shortcut-recorder {
  display: grid;
  grid-template-columns: 168px 28px 28px;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.shortcut-recorder input {
  width: 100%;
  height: 30px;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 9px;
  border: 1px solid var(--smw-border);
  border-radius: 6px;
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-input) 72%, transparent);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.shortcut-recorder.is-empty input {
  color: var(--smw-text-muted);
}

.shortcut-recorder input:focus {
  border-color: var(--smw-button-primary);
  background: var(--smw-bg-input);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.shortcut-recorder.has-conflict input {
  border-color: #d45b5b;
}

.shortcut-icon-button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-muted);
  background: transparent;
  cursor: pointer;
  opacity: 0.62;
  transition:
    color 150ms ease,
    opacity 150ms ease,
    transform 120ms ease,
    background-color 150ms ease;
  will-change: transform;
}

.shortcut-icon-button:not(:disabled):hover {
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, transparent);
  opacity: 1;
}

.shortcut-icon-button:not(:disabled):active {
  transform: translateY(1px) scale(0.9);
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
  opacity: 1;
}

.shortcut-icon-button:not(:disabled):active svg {
  transform: scale(0.92);
}

.shortcut-icon-button:not(:disabled):last-child:active svg {
  transform: rotate(-28deg) scale(0.92);
}

.shortcut-icon-button svg {
  transition: transform 150ms ease;
}

.shortcut-icon-button:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}

.shortcut-icon-button:disabled {
  cursor: default;
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .shortcut-icon-button,
  .shortcut-icon-button svg {
    transition: color 120ms ease, opacity 120ms ease, background-color 120ms ease;
  }

  .shortcut-icon-button:not(:disabled):active,
  .shortcut-icon-button:not(:disabled):active svg,
  .shortcut-icon-button:not(:disabled):last-child:active svg {
    transform: none;
  }
}
</style>
