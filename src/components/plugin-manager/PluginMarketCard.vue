<script setup lang="ts">
import type { PluginMarketItem, PluginMarketStatus } from '../../composables/usePluginMarket';
import PluginMarketActionButton from './PluginMarketActionButton.vue';
import PluginMarketCardBody from './PluginMarketCardBody.vue';
import PluginMarketIcon from './PluginMarketIcon.vue';

defineProps<{
  actionLabel: string;
  isInstalling: boolean;
  isSelected: boolean;
  plugin: PluginMarketItem;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
  pluginStatusLabel: (status: PluginMarketStatus) => string;
}>();

const emit = defineEmits<{
  action: [plugin: PluginMarketItem];
  select: [plugin: PluginMarketItem];
}>();
</script>

<template>
  <div
    :class="['plugin-market-card', { selected: isSelected }]"
    role="button"
    tabindex="0"
    @click="emit('select', plugin)"
    @keydown.enter.prevent="emit('select', plugin)"
    @keydown.space.prevent="emit('select', plugin)"
  >
    <PluginMarketIcon :icon="plugin.icon" :kind="plugin.kind" />
    <PluginMarketCardBody :plugin="plugin" :plugin-kind-label="pluginKindLabel" :plugin-status-label="pluginStatusLabel" />
    <PluginMarketActionButton :action-label="actionLabel" :is-installing="isInstalling" :status="plugin.status" @action="emit('action', plugin)" />
  </div>
</template>

<style scoped>
.plugin-market-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) max-content;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms ease;
}

.plugin-market-card:hover,
.plugin-market-card.selected {
  border-color: color-mix(in srgb, var(--smw-button-primary) 32%, var(--smw-border));
  background: color-mix(in srgb, var(--smw-bg-selected) 48%, var(--smw-bg-input));
}

.plugin-market-card:hover {
  transform: translateY(-1px);
}

@media (max-width: 860px) {
  .plugin-market-card {
    grid-template-columns: 38px minmax(0, 1fr);
  }
}
</style>
