<script setup lang="ts">
import type { PluginMarketPanelEmits, PluginMarketPanelProps } from '../../types/pluginManager';
import PluginMarketDetailPanel from './PluginMarketDetailPanel.vue';
import PluginMarketMain from './PluginMarketMain.vue';
import PluginMarketSidebar from './PluginMarketSidebar.vue';

defineProps<PluginMarketPanelProps>();

defineEmits<PluginMarketPanelEmits>();
</script>

<template>
  <div class="plugin-market-shell">
    <PluginMarketSidebar :active-category="activeCategory" :categories="categories" @select="$emit('selectCategory', $event)" />

    <PluginMarketMain
      :active-status="activeStatus"
      :is-installing-plugin="isInstallingPlugin"
      :loading="loading"
      :plugin-action-label="pluginActionLabel"
      :plugin-kind-label="pluginKindLabel"
      :plugin-status-label="pluginStatusLabel"
      :plugins="plugins"
      :search="search"
      :selected-plugin-id="selectedPlugin?.id ?? ''"
      :status-filters="statusFilters"
      @action="$emit('action', $event)"
      @select="$emit('selectPlugin', $event)"
      @update:active-status="$emit('update:activeStatus', $event)"
      @update:search="$emit('update:search', $event)"
    />

    <PluginMarketDetailPanel
      v-if="selectedPlugin"
      :active-screenshot="activeScreenshot"
      :active-screenshot-index="activeScreenshotIndex"
      :is-installing-plugin="isInstallingPlugin"
      :localized-capability="localizedCapability"
      :localized-permission="localizedPermission"
      :plugin="selectedPlugin"
      :plugin-action-label="pluginActionLabel"
      :plugin-kind-label="pluginKindLabel"
      :screenshots="screenshots"
      @action="$emit('action', $event)"
      @next-screenshot="$emit('nextScreenshot')"
      @previous-screenshot="$emit('previousScreenshot')"
      @select-screenshot="$emit('selectScreenshot', $event)"
    />
  </div>
</template>

<style scoped>
.plugin-market-shell {
  display: grid;
  grid-template-columns: 218px minmax(420px, 1fr) minmax(280px, 340px);
  gap: 16px;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

@media (max-width: 1180px) {
  .plugin-market-shell {
    grid-template-columns: 190px minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .plugin-market-shell {
    grid-template-columns: 1fr;
  }
}
</style>
