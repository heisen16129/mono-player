<script setup lang="ts">
import { CheckCircle2, Download, RefreshCw } from '@lucide/vue';
import type { PluginMarketItem } from '../../composables/usePluginMarket';

const props = defineProps<{
  isInstalling: boolean;
  label: string;
  plugin: PluginMarketItem;
}>();

const emit = defineEmits<{
  action: [plugin: PluginMarketItem];
}>();
</script>

<template>
  <button class="plugin-detail-primary" type="button" :disabled="plugin.status === 'installed' || isInstalling" @click="emit('action', plugin)">
    <RefreshCw v-if="isInstalling || plugin.status === 'update'" :class="{ spinning: isInstalling }" :size="15" />
    <CheckCircle2 v-else-if="plugin.status === 'installed'" :size="15" />
    <Download v-else :size="15" />
    {{ label }}
  </button>
</template>

<style scoped>
.plugin-detail-primary {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 34px;
  padding: 0 11px;
  border: 0;
  border-radius: 7px;
  color: #fff;
  background: var(--smw-button-primary);
  font-size: 12px;
  font-weight: 680;
  white-space: nowrap;
  cursor: pointer;
}

.plugin-detail-primary:disabled {
  border-color: var(--smw-border-soft);
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-selected) 54%, transparent);
  cursor: default;
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
