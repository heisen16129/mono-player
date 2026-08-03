<script setup lang="ts">
import { CheckCircle2, Download, RefreshCw } from '@lucide/vue';
import type { PluginMarketStatus } from '../../composables/usePluginMarket';

defineProps<{
  actionLabel: string;
  isInstalling: boolean;
  status: PluginMarketStatus;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <button class="plugin-card-action" :class="status" type="button" :disabled="status === 'installed' || isInstalling" @click.stop="emit('action')">
    <RefreshCw v-if="isInstalling || status === 'update'" :class="{ spinning: isInstalling }" :size="14" />
    <CheckCircle2 v-else-if="status === 'installed'" :size="14" />
    <Download v-else :size="14" />
    {{ actionLabel }}
  </button>
</template>

<style scoped>
.plugin-card-action {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-panel);
  font-size: 12px;
  font-weight: 680;
  white-space: nowrap;
}

.plugin-card-action:not(:disabled) {
  cursor: pointer;
}

.plugin-card-action.available {
  border-color: transparent;
  color: #fff;
  background: var(--smw-button-primary);
}

.plugin-card-action.installed {
  border-color: var(--smw-border-soft);
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-selected) 54%, transparent);
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 860px) {
  .plugin-card-action {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
