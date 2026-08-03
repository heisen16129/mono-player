<script setup lang="ts">
import type { PluginCapability, PluginCatalogItem, PluginManifest } from '../../types/plugin';
import PluginAuthorCell from './PluginAuthorCell.vue';
import PluginCapabilitiesCell from './PluginCapabilitiesCell.vue';
import PluginDragHandle from './PluginDragHandle.vue';
import PluginNameCell from './PluginNameCell.vue';
import PluginRowActions from './PluginRowActions.vue';
import PluginRowSelectCheckbox from './PluginRowSelectCheckbox.vue';
import PluginRuntimeBadge from './PluginRuntimeBadge.vue';
import PluginStateBadge from './PluginStateBadge.vue';
import PluginVersionCell from './PluginVersionCell.vue';
import type { PluginRow } from './types';

defineProps<{
  dragOverPluginId: string | null;
  draggingPluginId: string | null;
  formatCapabilities: (capabilities: PluginCapability[], installed?: boolean) => string;
  index: number;
  plugin: PluginRow;
  selected: boolean;
}>();

const emit = defineEmits<{
  install: [item: PluginCatalogItem];
  remove: [pluginId: string, pluginName: string];
  select: [pluginId: string, selected: boolean];
  startDrag: [event: PointerEvent, plugin: PluginRow];
  startRowDrag: [event: PointerEvent, plugin: PluginRow];
  toggle: [plugin: PluginManifest];
  update: [item: PluginCatalogItem];
}>();
</script>

<template>
  <tr
    :data-plugin-id="plugin.id"
    :class="{
      'is-draggable': plugin.installed,
      'is-dragging': draggingPluginId === plugin.id,
      'is-drag-over': dragOverPluginId === plugin.id && draggingPluginId !== plugin.id,
    }"
    @pointerdown="emit('startRowDrag', $event, plugin)"
  >
    <td>
      <PluginRowSelectCheckbox
        :plugin-name="plugin.name"
        :selected="selected"
        @select="emit('select', plugin.id, $event)"
      />
    </td>
    <td>
      <PluginDragHandle
        :active="draggingPluginId === plugin.id"
        :index="index"
        :installed="plugin.installed"
        @start-drag="emit('startDrag', $event, plugin)"
      />
    </td>
    <td><PluginNameCell :name="plugin.name" /></td>
    <td><PluginVersionCell :version="plugin.version" /></td>
    <td><PluginRuntimeBadge /></td>
    <td><PluginAuthorCell :author="plugin.author" /></td>
    <td>
      <PluginCapabilitiesCell
        :capabilities="plugin.capabilities"
        :format-capabilities="formatCapabilities"
        :installed="plugin.installed"
      />
    </td>
    <td><PluginStateBadge :enabled="plugin.enabled" :installed="plugin.installed" /></td>
    <td>
      <PluginRowActions
        :plugin="plugin"
        @install="emit('install', $event)"
        @remove="(pluginId, pluginName) => emit('remove', pluginId, pluginName)"
        @toggle="emit('toggle', $event)"
        @update="emit('update', $event)"
      />
    </td>
  </tr>
</template>

<style scoped>
td {
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--smw-border) 70%, transparent);
  text-align: left;
  vertical-align: middle;
}

tr:nth-child(even) td {
  background: color-mix(in srgb, var(--smw-bg-selected) 34%, transparent);
}

tr:hover td {
  background: color-mix(in srgb, var(--smw-bg-selected) 62%, transparent);
}

tr.is-draggable {
  cursor: grab;
}

tr.is-dragging {
  opacity: 0.42;
}

tr.is-drag-over td {
  background: color-mix(in srgb, var(--smw-button-primary) 12%, var(--smw-bg-selected));
  box-shadow: inset 0 1px 0 var(--smw-button-primary);
}

tr.is-draggable:active {
  cursor: grabbing;
}

td:first-child {
  text-align: center;
}

td:nth-child(2) {
  text-align: center;
}

td:nth-child(3),
td:nth-child(4),
td:nth-child(5),
td:nth-child(6),
td:nth-child(7),
td:nth-child(8),
td:nth-child(9) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
