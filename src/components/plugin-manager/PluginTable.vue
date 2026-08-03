<script setup lang="ts">
import { useScrollingState } from '../../composables/useScrollingState';
import type { PluginCapability, PluginCatalogItem, PluginManifest } from '../../types/plugin';
import PluginTableColumns from './PluginTableColumns.vue';
import PluginTableEmptyState from './PluginTableEmptyState.vue';
import PluginTableHeader from './PluginTableHeader.vue';
import PluginTableRow from './PluginTableRow.vue';
import type { PluginRow } from './types';

defineProps<{
  allVisibleSelected: boolean;
  dragOverPluginId: string | null;
  draggingPluginId: string | null;
  formatCapabilities: (capabilities: PluginCapability[], installed?: boolean) => string;
  loading: boolean;
  plugins: PluginRow[];
  selectedPluginIds: Set<string>;
}>();

const emit = defineEmits<{
  install: [item: PluginCatalogItem];
  remove: [pluginId: string, pluginName: string];
  select: [pluginId: string, selected: boolean];
  startDrag: [event: PointerEvent, plugin: PluginRow];
  startRowDrag: [event: PointerEvent, plugin: PluginRow];
  toggle: [plugin: PluginManifest];
  toggleAll: [];
  update: [item: PluginCatalogItem];
}>();

const { isScrolling, showScrolling } = useScrollingState();
</script>

<template>
  <div class="plugin-table-wrap transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" @scroll="showScrolling">
    <table class="plugin-table">
      <PluginTableColumns />
      <PluginTableHeader :all-visible-selected="allVisibleSelected" :disabled="plugins.length === 0" @toggle-all="emit('toggleAll')" />
      <tbody>
        <PluginTableRow
          v-for="(plugin, index) in plugins"
          :key="plugin.id"
          :drag-over-plugin-id="dragOverPluginId"
          :dragging-plugin-id="draggingPluginId"
          :format-capabilities="formatCapabilities"
          :index="index"
          :plugin="plugin"
          :selected="selectedPluginIds.has(plugin.id)"
          @install="emit('install', $event)"
          @remove="(pluginId, pluginName) => emit('remove', pluginId, pluginName)"
          @select="(pluginId, selected) => emit('select', pluginId, selected)"
          @start-drag="(event, rowPlugin) => emit('startDrag', event, rowPlugin)"
          @start-row-drag="(event, rowPlugin) => emit('startRowDrag', event, rowPlugin)"
          @toggle="emit('toggle', $event)"
          @update="emit('update', $event)"
        />
      </tbody>
    </table>

    <PluginTableEmptyState v-if="!loading && plugins.length === 0" message="暂无插件，添加订阅或从本地文件安装。" />
  </div>
</template>

<style scoped>
.plugin-table-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
}

.plugin-table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--smw-text-body);
  font-size: 13px;
}

</style>
