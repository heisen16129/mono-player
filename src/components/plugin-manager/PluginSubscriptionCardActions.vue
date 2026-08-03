<script setup lang="ts">
import { RefreshCw, Trash2 } from '@lucide/vue';

defineProps<{
  isSyncing: boolean;
  name: string;
}>();

const emit = defineEmits<{
  remove: [];
  sync: [];
}>();
</script>

<template>
  <span class="subscription-card-actions">
    <button
      class="subscription-action sync"
      type="button"
      :disabled="isSyncing"
      :aria-label="`同步订阅 ${name}`"
      :title="`同步订阅 ${name}`"
      @click="emit('sync')"
    >
      <RefreshCw :class="{ spinning: isSyncing }" :size="14" />
    </button>
    <button
      class="subscription-action delete"
      type="button"
      :aria-label="`删除订阅 ${name}`"
      :title="`删除订阅 ${name}`"
      @click="emit('remove')"
    >
      <Trash2 :size="14" />
    </button>
  </span>
</template>

<style scoped>
.subscription-card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  opacity: var(--subscription-actions-opacity, 0);
  pointer-events: var(--subscription-actions-pointer-events, none);
  transition: opacity 120ms ease;
}

.subscription-action {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.subscription-action:hover,
.subscription-action:focus-visible {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  outline: none;
}

.subscription-action.delete:hover,
.subscription-action.delete:focus-visible {
  border-color: color-mix(in srgb, var(--smw-status-red, #d64545) 34%, var(--smw-border));
  color: var(--smw-status-red, #d64545);
  background: color-mix(in srgb, var(--smw-status-red, #d64545) 8%, transparent);
}

.subscription-action:disabled {
  cursor: default;
  opacity: 0.62;
}
</style>
