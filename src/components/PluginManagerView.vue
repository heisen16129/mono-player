<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import PageHeader from './PageHeader.vue';
import {
  addPluginSubscription,
  fetchAllPluginCatalogs,
  fetchPluginCatalog,
  installCatalogPlugin,
  installLocalPlugin,
  listCachedPluginCatalog,
  listDeletedPluginIds,
  listInstalledPlugins,
  listPluginSubscriptions,
  restoreDeletedPluginsFromCatalog,
  saveCachedPluginCatalog,
  saveInstalledPlugins,
  setPluginEnabled,
  uninstallPlugin,
} from '../services/plugins';
import type { PluginCapability, PluginCatalogItem, PluginManifest, PluginSubscription } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import PluginBulkActions from './plugin-manager/PluginBulkActions.vue';
import PluginLoadingOverlay from './plugin-manager/PluginLoadingOverlay.vue';
import PluginManagerActions from './plugin-manager/PluginManagerActions.vue';
import PluginSubscriptionForm from './plugin-manager/PluginSubscriptionForm.vue';
import PluginTable from './plugin-manager/PluginTable.vue';
import type { PluginRow } from './plugin-manager/types';

const installedPlugins = ref<PluginManifest[]>([]);
const catalogPlugins = ref<PluginCatalogItem[]>([]);
const subscriptions = ref<PluginSubscription[]>([]);
const subscriptionUrl = ref('');
const isLoading = ref(false);
const isRefreshingSubscriptions = ref(false);
const isAddingSubscription = ref(false);
const isBatchBusy = ref(false);
const statusMessage = ref('');
const selectedPluginIds = ref<Set<string>>(new Set());
const deletedPluginIds = ref<Set<string>>(new Set());
const draggingPluginId = ref<string | null>(null);
const dragOverPluginId = ref<string | null>(null);
const hasPendingPluginOrderChange = ref(false);

const visiblePlugins = computed<PluginRow[]>(() => {
  const catalogById = new Map(catalogPlugins.value.map((plugin) => [plugin.id, plugin]));
  const installedRows = installedPlugins.value.map((plugin) => {
    const catalogItem = catalogById.get(plugin.id) ?? null;

    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      latestVersion: catalogItem?.version ?? plugin.version,
      author: plugin.author ?? '',
      runtime: plugin.runtime,
      capabilities: plugin.capabilities,
      installed: true,
      enabled: plugin.enabled,
      catalogItem,
      manifest: plugin,
    };
  });
  const installedIds = new Set(installedRows.map((item) => item.id));
  const catalogRows = catalogPlugins.value
    .filter((item) => !installedIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      version: item.version,
      latestVersion: item.version,
      author: item.author ?? '',
      runtime: item.runtime,
      capabilities: [],
      installed: false,
      enabled: false,
      catalogItem: item,
      manifest: null,
    }));

  return [...installedRows, ...catalogRows].filter((plugin) => !deletedPluginIds.value.has(plugin.id));
});

const selectedPlugins = computed(() => {
  return visiblePlugins.value.filter((plugin) => selectedPluginIds.value.has(plugin.id));
});

const selectedInstallablePlugins = computed(() => {
  return selectedPlugins.value.filter((plugin) => plugin.catalogItem && !plugin.installed);
});

const selectedEnabledPlugins = computed(() => {
  return selectedPlugins.value.filter((plugin) => plugin.manifest && plugin.enabled);
});

const allVisibleSelected = computed(() => {
  return visiblePlugins.value.length > 0 && visiblePlugins.value.every((plugin) => selectedPluginIds.value.has(plugin.id));
});

function mergeCatalogPlugins(currentPlugins: PluginCatalogItem[], nextPlugins: PluginCatalogItem[]) {
  const pluginById = new Map(currentPlugins.map((plugin) => [plugin.id, plugin]));
  for (const plugin of nextPlugins) {
    pluginById.set(plugin.id, plugin);
  }
  return [...pluginById.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function formatCapabilities(capabilities: PluginCapability[], installed = true) {
  if (!installed) return '';
  return capabilities.length > 0 ? capabilities.join(' / ') : '无可用能力';
}

function getInstalledPlugin(pluginId: string) {
  return installedPlugins.value.find((plugin) => plugin.id === pluginId) ?? null;
}

function pruneSelection() {
  const visibleIds = new Set(visiblePlugins.value.map((plugin) => plugin.id));
  selectedPluginIds.value = new Set([...selectedPluginIds.value].filter((id) => visibleIds.has(id)));
}

function setPluginSelected(pluginId: string, selected: boolean) {
  const nextSelected = new Set(selectedPluginIds.value);
  if (selected) {
    nextSelected.add(pluginId);
  } else {
    nextSelected.delete(pluginId);
  }
  selectedPluginIds.value = nextSelected;
}

function toggleAllVisiblePlugins() {
  if (allVisibleSelected.value) {
    selectedPluginIds.value = new Set();
    return;
  }

  selectedPluginIds.value = new Set(visiblePlugins.value.map((plugin) => plugin.id));
}

function startPluginPointerDrag(event: PointerEvent, plugin: PluginRow) {
  if (!plugin.installed || !plugin.manifest) return;

  event.preventDefault();
  event.stopPropagation();
  draggingPluginId.value = plugin.id;
  dragOverPluginId.value = plugin.id;
  hasPendingPluginOrderChange.value = false;
  window.addEventListener('pointermove', handlePluginPointerMove);
  window.addEventListener('pointerup', finishPluginPointerDrag, { once: true });
  window.addEventListener('pointercancel', cancelPluginPointerDrag, { once: true });
}

function startPluginRowPointerDrag(event: PointerEvent, plugin: PluginRow) {
  if (!plugin.installed || !plugin.manifest) return;
  if (event.button !== 0) return;

  const target = event.target;
  if (
    target instanceof HTMLElement
    && target.closest('button, input, a, select, textarea, .row-actions')
  ) {
    return;
  }

  startPluginPointerDrag(event, plugin);
}

function handlePluginPointerMove(event: PointerEvent) {
  if (!draggingPluginId.value) return;

  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLTableRowElement>('[data-plugin-id]');
  const pluginId = row?.dataset.pluginId;
  if (!pluginId) return;

  const plugin = visiblePlugins.value.find((item) => item.id === pluginId);
  if (plugin) moveDraggedPluginTo(plugin);
}

function moveDraggedPluginTo(plugin: PluginRow) {
  const sourceId = draggingPluginId.value;
  if (!sourceId || !plugin.installed || sourceId === plugin.id) return;

  const sourceIndex = installedPlugins.value.findIndex((item) => item.id === sourceId);
  const targetIndex = installedPlugins.value.findIndex((item) => item.id === plugin.id);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const nextInstalledPlugins = [...installedPlugins.value];
  const [movedPlugin] = nextInstalledPlugins.splice(sourceIndex, 1);
  nextInstalledPlugins.splice(targetIndex, 0, movedPlugin);
  installedPlugins.value = nextInstalledPlugins;
  dragOverPluginId.value = plugin.id;
  hasPendingPluginOrderChange.value = true;
}

async function finishPluginPointerDrag() {
  if (hasPendingPluginOrderChange.value) {
    await saveInstalledPlugins(installedPlugins.value);
    statusMessage.value = '插件排序已保存';
  }

  resetPluginPointerDragState();
}

function cancelPluginPointerDrag() {
  resetPluginPointerDragState();
}

function resetPluginPointerDragState() {
  window.removeEventListener('pointermove', handlePluginPointerMove);
  window.removeEventListener('pointerup', finishPluginPointerDrag);
  window.removeEventListener('pointercancel', cancelPluginPointerDrag);
  draggingPluginId.value = null;
  dragOverPluginId.value = null;
  hasPendingPluginOrderChange.value = false;
}

async function loadInstalledPlugins() {
  installedPlugins.value = await listInstalledPlugins();
  pruneSelection();
}

async function loadDeletedPluginIds() {
  deletedPluginIds.value = new Set(await listDeletedPluginIds());
  pruneSelection();
}

async function refreshCatalogs(showRefreshState = true) {
  isLoading.value = true;
  if (showRefreshState) isRefreshingSubscriptions.value = true;
  statusMessage.value = '';

  try {
    subscriptions.value = await listPluginSubscriptions();
    catalogPlugins.value = await fetchAllPluginCatalogs(subscriptions.value);
    await saveCachedPluginCatalog(catalogPlugins.value);
    const visibleCount = visiblePlugins.value.length;
    statusMessage.value = visibleCount > 0 ? `已更新 ${visibleCount} 个可显示插件` : '订阅已更新，暂无可显示插件';
  } catch (error) {
    statusMessage.value = `更新失败：${getErrorMessage(error, '更新失败')}`;
  } finally {
    isLoading.value = false;
    if (showRefreshState) isRefreshingSubscriptions.value = false;
    pruneSelection();
  }
}

async function installPlugin(item: PluginCatalogItem) {
  installedPlugins.value = await installCatalogPlugin(item);
  await loadDeletedPluginIds();
  const installedPlugin = getInstalledPlugin(item.id);
  statusMessage.value = `已安装 ${item.name}，检测能力：${formatCapabilities(installedPlugin?.capabilities ?? [])}`;
}

async function updatePlugin(item: PluginCatalogItem) {
  installedPlugins.value = await installCatalogPlugin(item);
  await loadDeletedPluginIds();
  const installedPlugin = getInstalledPlugin(item.id);
  statusMessage.value = `已更新 ${item.name}，检测能力：${formatCapabilities(installedPlugin?.capabilities ?? [])}`;
}

async function removePlugin(pluginId: string, pluginName: string) {
  installedPlugins.value = await uninstallPlugin(pluginId);
  catalogPlugins.value = catalogPlugins.value.filter((plugin) => plugin.id !== pluginId);
  await loadDeletedPluginIds();
  statusMessage.value = `已卸载 ${pluginName}`;
  pruneSelection();
}

async function togglePlugin(plugin: PluginManifest) {
  installedPlugins.value = await setPluginEnabled(plugin.id, !plugin.enabled);
}

async function batchInstallSelected() {
  if (selectedInstallablePlugins.value.length === 0) return;
  const pluginsToInstall = selectedInstallablePlugins.value;
  isBatchBusy.value = true;

  try {
    for (const plugin of pluginsToInstall) {
      if (plugin.catalogItem) installedPlugins.value = await installCatalogPlugin(plugin.catalogItem);
    }
    await loadDeletedPluginIds();
    statusMessage.value = `已安装 ${pluginsToInstall.length} 个插件`;
  } finally {
    isBatchBusy.value = false;
    pruneSelection();
  }
}

async function batchUninstallSelected() {
  if (selectedPlugins.value.length === 0) return;
  const pluginsToUninstall = selectedPlugins.value;
  isBatchBusy.value = true;

  try {
    for (const plugin of pluginsToUninstall) {
      installedPlugins.value = await uninstallPlugin(plugin.id);
      catalogPlugins.value = catalogPlugins.value.filter((item) => item.id !== plugin.id);
    }
    await loadDeletedPluginIds();
    statusMessage.value = `已卸载 ${pluginsToUninstall.length} 个插件`;
  } finally {
    isBatchBusy.value = false;
    pruneSelection();
  }
}

async function batchDisableSelected() {
  if (selectedEnabledPlugins.value.length === 0) return;
  const pluginsToDisable = selectedEnabledPlugins.value;
  isBatchBusy.value = true;

  try {
    for (const plugin of pluginsToDisable) {
      if (plugin.manifest) installedPlugins.value = await setPluginEnabled(plugin.manifest.id, false);
    }
    statusMessage.value = `已停用 ${pluginsToDisable.length} 个插件`;
  } finally {
    isBatchBusy.value = false;
    pruneSelection();
  }
}

async function importFromLocalFile() {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'WASM Plugin', extensions: ['wasm'] },
    ],
  });

  if (typeof selected !== 'string') return;
  installedPlugins.value = await installLocalPlugin(selected);
  await loadDeletedPluginIds();
  statusMessage.value = '已导入本地插件';
}

async function addSubscription() {
  const url = subscriptionUrl.value.trim();
  if (!url || isAddingSubscription.value) return;

  isAddingSubscription.value = true;
  statusMessage.value = '';

  try {
    subscriptions.value = await addPluginSubscription(url);
    const subscription = subscriptions.value.find((item) => item.url === url);
    if (!subscription) throw new Error('订阅保存失败');
    const addedPlugins = await fetchPluginCatalog(subscription);
    catalogPlugins.value = mergeCatalogPlugins(catalogPlugins.value, addedPlugins);
    await saveCachedPluginCatalog(catalogPlugins.value);
    await restoreDeletedPluginsFromCatalog(addedPlugins);
    await loadDeletedPluginIds();
    const visibleCount = visiblePlugins.value.length;
    statusMessage.value = `已添加 ${addedPlugins.length} 个插件，当前共 ${visibleCount} 个可显示插件`;
  } catch (error) {
    statusMessage.value = `订阅失败：${getErrorMessage(error, '订阅失败')}`;
  } finally {
    isAddingSubscription.value = false;
  }
}

onMounted(async () => {
  await loadInstalledPlugins();
  await loadDeletedPluginIds();
  subscriptions.value = await listPluginSubscriptions();
  catalogPlugins.value = await listCachedPluginCatalog();
  pruneSelection();
});

onBeforeUnmount(() => {
  resetPluginPointerDragState();
});
</script>

<template>
  <section class="plugin-manager-view">
    <PageHeader class="plugin-header" title="插件管理" subtitle="管理 WASM 原生插件。">
      <template #actions>
        <PluginManagerActions :refreshing="isRefreshingSubscriptions" @import-local="importFromLocalFile" @refresh="refreshCatalogs()" />
      </template>
    </PageHeader>

    <PluginSubscriptionForm v-model="subscriptionUrl" :adding="isAddingSubscription" @add="addSubscription" />

    <div v-if="false" class="subscription-list">
      <span v-for="subscription in subscriptions" :key="subscription.id">
        {{ subscription.name }} · {{ subscription.url }}
      </span>
    </div>

    <p v-if="statusMessage" class="plugin-status">{{ statusMessage }}</p>

    <PluginBulkActions
      :busy="isBatchBusy"
      :enabled-count="selectedEnabledPlugins.length"
      :installable-count="selectedInstallablePlugins.length"
      :selected-count="selectedPlugins.length"
      @disable="batchDisableSelected"
      @install="batchInstallSelected"
      @uninstall="batchUninstallSelected"
    />

    <PluginTable
      :all-visible-selected="allVisibleSelected"
      :drag-over-plugin-id="dragOverPluginId"
      :dragging-plugin-id="draggingPluginId"
      :format-capabilities="formatCapabilities"
      :loading="isLoading"
      :plugins="visiblePlugins"
      :selected-plugin-ids="selectedPluginIds"
      @install="installPlugin"
      @remove="removePlugin"
      @select="setPluginSelected"
      @start-drag="startPluginPointerDrag"
      @start-row-drag="startPluginRowPointerDrag"
      @toggle="togglePlugin"
      @toggle-all="toggleAllVisiblePlugins"
      @update="updatePlugin"
    />

    <PluginLoadingOverlay v-if="isAddingSubscription" />
  </section>
</template>

<style scoped>
.plugin-manager-view {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 24px 30px 30px;
  background: var(--smw-bg-workspace);
}

.subscription-list {
  display: none;
  grid-template-columns: repeat(auto-fit, minmax(260px, max-content));
  gap: 8px 10px;
  align-items: start;
  margin: 2px 0 10px;
  min-height: 28px;
}

.subscription-list span {
  display: block;
  max-width: min(680px, 100%);
  overflow: hidden;
  padding: 5px 8px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-status {
  min-height: 20px;
  margin: 0 0 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

@media (max-width: 860px) {
  .plugin-header {
    display: grid;
    padding-right: 0;
  }
}
</style>


