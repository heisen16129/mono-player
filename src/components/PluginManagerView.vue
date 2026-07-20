<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import EmptyState from './EmptyState.vue';
import PageHeader from './PageHeader.vue';
import {
  Download,
  FolderInput,
  RefreshCw,
  Settings2,
  Trash2,
} from '@lucide/vue';
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
import type { PluginCapability, PluginCatalogItem, PluginManifest, PluginRuntime, PluginSubscription } from '../types/plugin';
import { getErrorMessage } from '../utils/error';

interface PluginRow {
  id: string;
  name: string;
  version: string;
  latestVersion: string;
  author: string;
  runtime: PluginRuntime;
  capabilities: PluginCapability[];
  installed: boolean;
  enabled: boolean;
  catalogItem: PluginCatalogItem | null;
  manifest: PluginManifest | null;
}

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
        <div class="plugin-actions">
          <button class="secondary-button" type="button" @click="importFromLocalFile">
            <FolderInput :size="16" />
            从本地文件安装
          </button>
          <button class="secondary-button" type="button" :disabled="isRefreshingSubscriptions" @click="refreshCatalogs()">
            <RefreshCw :size="16" :class="{ spinning: isRefreshingSubscriptions }" />
            更新订阅
          </button>
        </div>
      </template>
    </PageHeader>

    <section class="subscription-row" aria-label="插件订阅">
      <label>
        <span>订阅地址</span>
        <input
          v-model="subscriptionUrl"
          type="url"
          :disabled="isAddingSubscription"
          placeholder="https://example.com/plugins.json 或 plugin.wasm"
          @keydown.enter="addSubscription"
        />
      </label>
      <button class="primary-button subscription-submit" type="button" :disabled="isAddingSubscription || !subscriptionUrl.trim()" @click="addSubscription">
        <Settings2 :size="16" />
        <span>{{ isAddingSubscription ? '添加中...' : '添加订阅' }}</span>
      </button>
    </section>

    <div v-if="false" class="subscription-list">
      <span v-for="subscription in subscriptions" :key="subscription.id">
        {{ subscription.name }} · {{ subscription.url }}
      </span>
    </div>

    <p v-if="statusMessage" class="plugin-status">{{ statusMessage }}</p>

    <div class="plugin-bulk-bar" :class="{ active: selectedPlugins.length > 0 }">
      <span>已选择 {{ selectedPlugins.length }} 个插件</span>
      <button class="secondary-button compact" type="button" :disabled="isBatchBusy || selectedInstallablePlugins.length === 0" @click="batchInstallSelected">
        <Download :size="15" />
        批量安装
      </button>
      <button class="secondary-button compact" type="button" :disabled="isBatchBusy || selectedPlugins.length === 0" @click="batchUninstallSelected">
        <Trash2 :size="15" />
        批量卸载
      </button>
      <button class="secondary-button compact" type="button" :disabled="isBatchBusy || selectedEnabledPlugins.length === 0" @click="batchDisableSelected">
        批量停用
      </button>
    </div>

    <div class="plugin-table-wrap">
      <table class="plugin-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" :checked="allVisibleSelected" :disabled="visiblePlugins.length === 0" aria-label="选择全部插件" @change="toggleAllVisiblePlugins" />
            </th>
            <th>#</th>
            <th>来源</th>
            <th>版本号</th>
            <th>类型</th>
            <th>作者</th>
            <th>能力</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(plugin, index) in visiblePlugins" :key="plugin.id">
            <tr
              :data-plugin-id="plugin.id"
              :class="{
                'is-draggable': plugin.installed,
                'is-dragging': draggingPluginId === plugin.id,
                'is-drag-over': dragOverPluginId === plugin.id && draggingPluginId !== plugin.id,
              }"
              @pointerdown="startPluginRowPointerDrag($event, plugin)"
            >
              <td>
                <input type="checkbox" :checked="selectedPluginIds.has(plugin.id)" :aria-label="`选择 ${plugin.name}`" @change="setPluginSelected(plugin.id, ($event.target as HTMLInputElement).checked)" />
              </td>
              <td>
                <button class="drag-handle" type="button" :class="{ active: draggingPluginId === plugin.id }" :title="plugin.installed ? '拖动排序' : ''" @pointerdown="startPluginPointerDrag($event, plugin)">
                  {{ index + 1 }}
                </button>
              </td>
              <td><strong>{{ plugin.name }}</strong></td>
              <td>{{ plugin.version }}</td>
              <td><span class="runtime-badge">WASM</span></td>
              <td>{{ plugin.author || '未知作者' }}</td>
              <td>
                <span class="capabilities" :title="formatCapabilities(plugin.capabilities, plugin.installed)">
                  {{ formatCapabilities(plugin.capabilities, plugin.installed) }}
                </span>
              </td>
              <td>
                <span :class="['state-badge', plugin.installed ? 'installed' : 'available']">
                  {{ plugin.installed ? (plugin.enabled ? '已启用' : '已停用') : '可安装' }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button v-if="plugin.catalogItem && !plugin.installed" class="link-action install" type="button" @click="installPlugin(plugin.catalogItem)">
                    <Download :size="14" />
                    安装
                  </button>
                  <button v-if="plugin.catalogItem && plugin.installed && plugin.latestVersion !== plugin.version" class="link-action update" type="button" @click="updatePlugin(plugin.catalogItem)">
                    <RefreshCw :size="14" />
                    更新
                  </button>
                  <button v-if="plugin.manifest" :class="['plugin-toggle-action', plugin.enabled ? 'is-enabled' : 'is-disabled']" type="button" :title="plugin.enabled ? '点击停用插件' : '点击启用插件'" @click="togglePlugin(plugin.manifest)">
                    <span aria-hidden="true"></span>
                    {{ plugin.enabled ? '停用' : '启用' }}
                  </button>
                  <button v-if="plugin.installed" class="link-action danger" type="button" @click="removePlugin(plugin.id, plugin.name)">
                    <Trash2 :size="14" />
                    卸载
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <EmptyState v-if="!isLoading && visiblePlugins.length === 0" class-name="empty-plugins" message="暂无插件，添加订阅或从本地文件安装。" />
    </div>

    <div v-if="isAddingSubscription" class="plugin-loading-overlay" role="status" aria-live="polite">
      <div class="plugin-loading-dialog">
        <div class="install-bars" aria-hidden="true"><span></span><span></span><span></span></div>
        <strong>正在添加订阅...</strong>
        <p>正在读取插件源</p>
      </div>
    </div>
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

.plugin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.subscription-submit {
  height: 36px;
  font-size: 0;
}

.subscription-submit span {
  font-size: 13px;
}

.subscription-row {
  display: grid;
  grid-template-columns: minmax(320px, 560px) 150px;
  gap: 12px;
  align-items: end;
  justify-content: start;
  padding: 18px 0 8px;
}

.subscription-row label {
  display: grid;
  gap: 8px;
}

.subscription-row label > span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-weight: 560;
}

.subscription-row input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
}

.subscription-row input:focus {
  border-color: var(--smw-text-primary);
  box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
}

.subscription-row input:disabled {
  cursor: wait;
  opacity: 0.72;
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

.plugin-bulk-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: fit-content;
  min-height: 42px;
  margin: 0 0 14px;
  padding: 6px 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-input) 78%, transparent);
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.plugin-bulk-bar.active {
  border-color: color-mix(in srgb, var(--smw-button-primary) 24%, var(--smw-border));
  background: color-mix(in srgb, var(--smw-bg-selected) 58%, var(--smw-bg-input));
}

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

.plugin-table th,
.plugin-table td {
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--smw-border) 70%, transparent);
  text-align: left;
  vertical-align: middle;
}

.plugin-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-input) 92%, var(--smw-bg-selected));
  font-weight: 680;
}

.plugin-table tr:nth-child(even) td {
  background: color-mix(in srgb, var(--smw-bg-selected) 34%, transparent);
}

.plugin-table tbody tr:hover td {
  background: color-mix(in srgb, var(--smw-bg-selected) 62%, transparent);
}

.plugin-table tbody tr.is-draggable {
  cursor: grab;
}

.plugin-table tbody tr.is-dragging {
  opacity: 0.42;
}

.plugin-table tbody tr.is-drag-over td {
  background: color-mix(in srgb, var(--smw-button-primary) 12%, var(--smw-bg-selected));
  box-shadow: inset 0 1px 0 var(--smw-button-primary);
}

.plugin-table tbody tr.is-draggable:active {
  cursor: grabbing;
}

.plugin-table td:first-child,
.plugin-table th:first-child {
  width: 34px;
  text-align: center;
}

.plugin-table td:nth-child(2),
.plugin-table th:nth-child(2) {
  width: 42px;
  text-align: center;
}

.plugin-table td:nth-child(3),
.plugin-table th:nth-child(3) {
  width: 18%;
}

.plugin-table td:nth-child(4),
.plugin-table th:nth-child(4) {
  width: 8%;
}

.plugin-table td:nth-child(5),
.plugin-table th:nth-child(5) {
  width: 8%;
}

.plugin-table td:nth-child(6),
.plugin-table th:nth-child(6) {
  width: 13%;
}

.plugin-table td:nth-child(7),
.plugin-table th:nth-child(7) {
  width: 28%;
}

.plugin-table td:nth-child(8),
.plugin-table th:nth-child(8) {
  width: 9%;
}

.plugin-table td:nth-child(9),
.plugin-table th:nth-child(9) {
  width: 14%;
}

.plugin-table td:nth-child(3),
.plugin-table td:nth-child(4),
.plugin-table td:nth-child(5),
.plugin-table td:nth-child(6),
.plugin-table td:nth-child(7),
.plugin-table td:nth-child(8),
.plugin-table td:nth-child(9) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-table input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--smw-button-primary);
}

.drag-handle {
  display: inline-grid;
  width: 28px;
  height: 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  user-select: none;
  touch-action: none;
}

.is-draggable .drag-handle {
  cursor: grab;
}

.is-draggable .drag-handle:hover,
.is-draggable .drag-handle.active {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.is-draggable .drag-handle:active {
  cursor: grabbing;
}

.plugin-table strong {
  color: var(--smw-text-primary);
  font-weight: 560;
}

.runtime-badge,
.state-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
}

.runtime-badge {
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-selected) 55%, transparent);
}

.state-badge.installed {
  color: var(--smw-status-green);
}

.state-badge.available {
  color: var(--smw-text-secondary);
}

.capabilities {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.link-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.link-action:hover,
.plugin-toggle-action:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.plugin-toggle-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 24px;
  padding: 0;
  border: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 560;
  cursor: pointer;
}

.plugin-toggle-action span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.plugin-toggle-action.is-enabled {
  color: var(--smw-text-body);
  background: transparent;
}

.plugin-toggle-action.is-enabled span {
  background: var(--smw-status-green);
}

.plugin-toggle-action.is-disabled {
  color: var(--smw-text-secondary);
  background: transparent;
}

.plugin-toggle-action.is-disabled span {
  background: var(--smw-text-secondary);
}

.link-action.install,
.link-action.update {
  color: var(--smw-status-green);
}

.link-action.danger {
  color: var(--smw-error-text);
}

.empty-plugins {
  padding: 34px 16px;
  font-size: 13px;
}

.plugin-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--smw-bg-workspace) 76%, transparent);
  backdrop-filter: blur(2px);
}

.plugin-loading-dialog {
  display: grid;
  justify-items: center;
  min-width: 260px;
  padding: 32px 36px 30px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.plugin-loading-dialog strong {
  margin-top: 14px;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 650;
}

.plugin-loading-dialog p {
  margin: 6px 0 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.install-bars {
  display: inline-flex;
  gap: 8px;
  align-items: end;
  height: 58px;
}

.install-bars span {
  width: 15px;
  border-radius: 3px 3px 1px 1px;
  background: var(--smw-button-primary);
  animation: installBars 820ms ease-in-out infinite;
}

.install-bars span:nth-child(1) {
  height: 46px;
}

.install-bars span:nth-child(2) {
  height: 30px;
  animation-delay: 110ms;
}

.install-bars span:nth-child(3) {
  height: 34px;
  animation-delay: 220ms;
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes installBars {
  0%,
  100% {
    transform: scaleY(0.72);
    opacity: 0.66;
  }

  45% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@media (max-width: 860px) {
  .plugin-header {
    display: grid;
    padding-right: 0;
  }

  .plugin-actions {
    justify-content: flex-start;
  }

  .subscription-row {
    grid-template-columns: 1fr;
  }
}
</style>
