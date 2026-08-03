<script setup lang="ts">
import type { PluginMarketItem, PluginMarketStatus } from '../../composables/usePluginMarket';
import PluginMarketList from './PluginMarketList.vue';
import PluginMarketSearchField from './PluginMarketSearchField.vue';
import PluginMarketStatusFilters from './PluginMarketStatusFilters.vue';

defineProps<{
  activeStatus: 'all' | PluginMarketStatus;
  isInstallingPlugin: (pluginId: string) => boolean;
  loading: boolean;
  pluginActionLabel: (plugin: PluginMarketItem) => string;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
  pluginStatusLabel: (status: PluginMarketStatus) => string;
  plugins: PluginMarketItem[];
  search: string;
  selectedPluginId: string;
  statusFilters: Array<{ id: 'all' | PluginMarketStatus; label: string }>;
}>();

const emit = defineEmits<{
  action: [plugin: PluginMarketItem];
  select: [plugin: PluginMarketItem];
  'update:activeStatus': [status: 'all' | PluginMarketStatus];
  'update:search': [value: string];
}>();
</script>

<template>
  <main class="plugin-market-main">
    <div class="plugin-market-toolbar">
      <PluginMarketSearchField :model-value="search" @update:model-value="emit('update:search', $event)" />
    </div>

    <PluginMarketStatusFilters
      :active-status="activeStatus"
      :filters="statusFilters"
      @select="emit('update:activeStatus', $event)"
    />

    <PluginMarketList
      :is-installing-plugin="isInstallingPlugin"
      :loading="loading"
      :plugin-action-label="pluginActionLabel"
      :plugin-kind-label="pluginKindLabel"
      :plugin-status-label="pluginStatusLabel"
      :plugins="plugins"
      :selected-plugin-id="selectedPluginId"
      @action="emit('action', $event)"
      @select="emit('select', $event)"
    />
  </main>
</template>

<style scoped>
.plugin-market-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.plugin-market-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

@media (max-width: 860px) {
  .plugin-market-toolbar {
    grid-template-columns: 1fr;
  }

}
</style>
