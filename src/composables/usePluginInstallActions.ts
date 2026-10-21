import { ref, type ComputedRef, type Ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import {
  installCatalogPlugin,
  batchPluginActions,
  listInstalledPlugins,
  type PluginAction,
  installLocalPlugin,
  setPluginEnabled,
  uninstallPlugin,
} from '../services/plugins';
import { usePlayerStore } from '../stores/player';
import type { PluginCatalogItem, PluginManifest } from '../types/plugin';
import type { PluginRow } from '../components/plugin-manager/types';
import { PLUGINS_CHANGED_EVENT } from './useMusicSourcePluginAvailability';

interface UsePluginInstallActionsOptions {
  catalogPlugins: Ref<PluginCatalogItem[]>;
  installedPlugins: Ref<PluginManifest[]>;
  loadDeletedPluginIds: () => Promise<void>;
  notify: (message: string) => void;
  pruneSelection: () => void;
  selectedEnabledPlugins: ComputedRef<PluginRow[]>;
  selectedInstallablePlugins: ComputedRef<PluginRow[]>;
  selectedPlugins: ComputedRef<PluginRow[]>;
}

export function usePluginInstallActions({
  catalogPlugins,
  installedPlugins,
  loadDeletedPluginIds,
  notify,
  pruneSelection,
  selectedEnabledPlugins,
  selectedInstallablePlugins,
  selectedPlugins,
}: UsePluginInstallActionsOptions) {
  const player = usePlayerStore();
  const isBatchBusy = ref(false);

  function notifyInstalledPluginsChanged() {
    window.dispatchEvent(new CustomEvent(PLUGINS_CHANGED_EVENT));
    void player.reloadThemes().catch(() => {});
  }

  async function installPlugin(item: PluginCatalogItem) {
    installedPlugins.value = await installCatalogPlugin(item);
    notifyInstalledPluginsChanged();
    await loadDeletedPluginIds();
    notify(`已安装 ${item.name}`);
  }

  async function updatePlugin(item: PluginCatalogItem) {
    installedPlugins.value = await installCatalogPlugin(item, true);
    notifyInstalledPluginsChanged();
    await loadDeletedPluginIds();
    notify(`已更新 ${item.name}`);
  }

  async function removePlugin(pluginId: string, pluginName: string) {
    installedPlugins.value = await uninstallPlugin(pluginId);
    notifyInstalledPluginsChanged();
    catalogPlugins.value = catalogPlugins.value.filter((plugin) => plugin.id !== pluginId);
    await loadDeletedPluginIds();
    notify(`已卸载 ${pluginName}`);
    pruneSelection();
  }

  async function togglePlugin(plugin: PluginManifest) {
    installedPlugins.value = await setPluginEnabled(plugin.id, !plugin.enabled);
    notifyInstalledPluginsChanged();
  }

  async function runBatch(requests: PluginAction[]) {
    if (!requests.length || isBatchBusy.value) return;
    isBatchBusy.value = true;
    try {
      const results = await batchPluginActions(requests, (completed, total) => notify(`正在处理插件 ${completed}/${total}`));
      installedPlugins.value = await listInstalledPlugins();
      const removed = new Set(results.filter(r => r.success && requests[r.index]?.action === 'uninstall').map(r => r.id));
      catalogPlugins.value = catalogPlugins.value.filter(p => !removed.has(p.id));
      notifyInstalledPluginsChanged();
      await loadDeletedPluginIds();
      const failed = results.filter(r => !r.success);
      notify(`完成 ${results.length - failed.length} 个插件${failed.length ? `，失败 ${failed.length} 个：${failed.map(r => r.error).join('；')}` : ''}`);
    } finally {
      isBatchBusy.value = false;
      pruneSelection();
    }
  }

  async function batchInstallSelected() {
    await runBatch(selectedInstallablePlugins.value.flatMap(p => p.catalogItem ? [{ action: p.installed ? 'update' as const : 'install' as const, item: p.catalogItem }] : []));
  }

  async function batchUninstallSelected() {
    await runBatch(selectedPlugins.value.filter(p => p.installed).map(p => ({ action: 'uninstall', id: p.id })));
  }

  async function batchDisableSelected() {
    await runBatch(selectedEnabledPlugins.value.map(p => ({ action: 'enabled', id: p.id, enabled: false })));
  }

  async function importFromLocalFile() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'Mono 插件包', extensions: ['zip'] },
      ],
    });

    if (typeof selected !== 'string') return;
    installedPlugins.value = await installLocalPlugin(selected);
    notifyInstalledPluginsChanged();
    await loadDeletedPluginIds();
    notify('已导入本地插件');
  }

  return {
    batchDisableSelected,
    batchInstallSelected,
    batchUninstallSelected,
    importFromLocalFile,
    installPlugin,
    isBatchBusy,
    removePlugin,
    togglePlugin,
    updatePlugin,
  };
}
