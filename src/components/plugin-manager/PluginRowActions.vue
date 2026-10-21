<script setup lang="ts">
import type { PluginCatalogItem, PluginManifest } from '../../types/plugin';
import type { PluginRow } from './types';
import PluginRowLinkActionButton from './PluginRowLinkActionButton.vue';
import PluginRowToggleActionButton from './PluginRowToggleActionButton.vue';
import { computed } from 'vue';
import { usePluginNavigation } from '../../composables/usePluginNavigation';

const props = defineProps<{
  plugin: PluginRow;
}>();

const { plugins, openPlugin } = usePluginNavigation();
const pages = computed(() => plugins.value.find(p => p.id === props.plugin.id)?.contributions.pages ?? []);

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
      <button class="page-action" type="button" v-for="page in pages" :key="page.id" :disabled="!plugin.enabled" @click="openPlugin(plugin.id,page.id)">{{ page.title }}</button>
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
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  min-width: 0;
  padding: 6px 0;
}

.row-actions > :deep(button) {
  flex-shrink: 0;
}

.page-action {
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--smw-text-body);
  font: inherit;
  line-height: 24px;
  white-space: normal;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.page-action:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.page-action:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
