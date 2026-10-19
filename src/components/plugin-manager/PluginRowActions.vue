<script setup lang="ts">
import type { PluginCatalogItem, PluginManifest } from '../../types/plugin';
import type { PluginRow } from './types';
import PluginRowLinkActionButton from './PluginRowLinkActionButton.vue';
import PluginRowToggleActionButton from './PluginRowToggleActionButton.vue';
import { getPluginLaunchers } from '../plugins/pluginLaunchers';

defineProps<{
  plugin: PluginRow;
}>();

const emit = defineEmits<{
  install: [item: PluginCatalogItem];
  remove: [pluginId: string, pluginName: string];
  toggle: [plugin: PluginManifest];
  update: [item: PluginCatalogItem];
}>();
</script>

<template>
  <div class="row-actions">
    <template v-if="plugin.installed">
      <component v-for="launcher in getPluginLaunchers(plugin)" :is="launcher.component" :key="launcher.capability" :plugin-id="plugin.id" :disabled="!plugin.enabled" />
    </template>
    <PluginRowLinkActionButton v-if="plugin.catalogItem && !plugin.installed" label="安装" variant="install" @click="emit('install', plugin.catalogItem)" />
    <PluginRowLinkActionButton v-if="plugin.catalogItem && plugin.installed && plugin.catalogItem.managementStatus === 'update'" label="更新" variant="update" @click="emit('update', plugin.catalogItem)" />
    <PluginRowToggleActionButton v-if="plugin.manifest" :enabled="plugin.enabled" @toggle="emit('toggle', plugin.manifest)" />
    <PluginRowLinkActionButton v-if="plugin.installed" label="卸载" variant="danger" @click="emit('remove', plugin.id, plugin.name)" />
  </div>
</template>

<style scoped>
.row-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

</style>
