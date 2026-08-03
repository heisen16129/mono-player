<script setup lang="ts">
import PluginBulkActions from './PluginBulkActions.vue';
import PluginTable from './PluginTable.vue';
import type { PluginInstalledPanelEmits, PluginInstalledPanelProps } from '../../types/pluginManager';

defineProps<PluginInstalledPanelProps>();

defineEmits<PluginInstalledPanelEmits>();
</script>

<template>
  <div class="plugin-installed-panel">
    <PluginBulkActions
      :busy="busy"
      :enabled-count="enabledCount"
      :installable-count="installableCount"
      :selected-count="selectedCount"
      @disable="$emit('batchDisable')"
      @install="$emit('batchInstall')"
      @uninstall="$emit('batchUninstall')"
    />

    <PluginTable
      :all-visible-selected="allVisibleSelected"
      :drag-over-plugin-id="dragOverPluginId"
      :dragging-plugin-id="draggingPluginId"
      :format-capabilities="formatCapabilities"
      :loading="loading"
      :plugins="plugins"
      :selected-plugin-ids="selectedPluginIds"
      @install="$emit('install', $event)"
      @remove="(pluginId, pluginName) => $emit('remove', pluginId, pluginName)"
      @select="(pluginId, selected) => $emit('select', pluginId, selected)"
      @start-drag="(event, plugin) => $emit('startDrag', event, plugin)"
      @start-row-drag="(event, plugin) => $emit('startRowDrag', event, plugin)"
      @toggle="$emit('toggle', $event)"
      @toggle-all="$emit('toggleAll')"
      @update="$emit('update', $event)"
    />
  </div>
</template>

<style scoped>
.plugin-installed-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
