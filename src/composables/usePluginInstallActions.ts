import { ref, type ComputedRef, type Ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import {
  installCatalogPlugin,
  installLocalPlugin,
  readPluginTheme,
  setPluginEnabled,
  uninstallPlugin,
} from '../services/plugins';
import { usePlayerStore } from '../stores/player';
import type { CustomTheme } from '../types/music';
import type { PluginCatalogItem, PluginManifest } from '../types/plugin';
import type { PluginRow } from '../components/plugin-manager/types';
import { getErrorMessage } from '../utils/error';

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

  function pluginThemeId(themeId: string | undefined, fallbackId: string): CustomTheme['id'] {
    const id = themeId?.trim() || fallbackId;
    return (id.startsWith('custom:') ? id : `custom:${id}`) as CustomTheme['id'];
  }

  async function addThemeFromPlugin(manifest: PluginManifest): Promise<boolean> {
    if (manifest.kind !== 'theme' || !manifest.capabilities.includes('theme')) return false;

    const theme = await readPluginTheme(manifest);
    player.addCustomTheme({
      id: pluginThemeId(theme.id, manifest.id),
      name: theme.name?.trim() || manifest.name,
      author: theme.author?.trim() || manifest.author,
      variables: theme.variables,
      preview: theme.preview ?? manifest.icon ?? null,
      background: theme.background ?? null,
      backgroundOpacity: theme.backgroundOpacity ?? null,
    }, false);
    return true;
  }

  async function removeThemeFromPlugin(manifest: PluginManifest) {
    if (manifest.kind !== 'theme' || !manifest.capabilities.includes('theme')) return;

    try {
      const theme = await readPluginTheme(manifest);
      player.removeCustomTheme(pluginThemeId(theme.id, manifest.id));
    } catch {
      player.removeCustomTheme(pluginThemeId(undefined, manifest.id));
    }
  }

  async function installPlugin(item: PluginCatalogItem) {
    installedPlugins.value = await installCatalogPlugin(item);
    const manifest = installedPlugins.value.find((plugin) => plugin.id === item.id);
    let themeInstalled = false;
    if (manifest) {
      try {
        themeInstalled = await addThemeFromPlugin(manifest);
      } catch (error) {
        notify(`已安装 ${item.name}，主题读取失败：${getErrorMessage(error, '读取失败')}`);
        await loadDeletedPluginIds();
        return;
      }
    }
    await loadDeletedPluginIds();
    notify(themeInstalled ? `已安装 ${item.name}，主题已加入本地主题` : `已安装 ${item.name}`);
  }

  async function updatePlugin(item: PluginCatalogItem) {
    installedPlugins.value = await installCatalogPlugin(item);
    const manifest = installedPlugins.value.find((plugin) => plugin.id === item.id);
    let themeUpdated = false;
    if (manifest) {
      try {
        themeUpdated = await addThemeFromPlugin(manifest);
      } catch (error) {
        notify(`已更新 ${item.name}，主题读取失败：${getErrorMessage(error, '读取失败')}`);
        await loadDeletedPluginIds();
        return;
      }
    }
    await loadDeletedPluginIds();
    notify(themeUpdated ? `已更新 ${item.name}，主题已同步` : `已更新 ${item.name}`);
  }

  async function removePlugin(pluginId: string, pluginName: string) {
    const manifest = installedPlugins.value.find((plugin) => plugin.id === pluginId);
    installedPlugins.value = await uninstallPlugin(pluginId);
    if (manifest) await removeThemeFromPlugin(manifest);
    catalogPlugins.value = catalogPlugins.value.filter((plugin) => plugin.id !== pluginId);
    await loadDeletedPluginIds();
    notify(`已卸载 ${pluginName}`);
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
        if (plugin.catalogItem) {
          installedPlugins.value = await installCatalogPlugin(plugin.catalogItem);
          const manifest = installedPlugins.value.find((item) => item.id === plugin.catalogItem?.id);
          if (manifest) await addThemeFromPlugin(manifest);
        }
      }
      await loadDeletedPluginIds();
      notify(`已安装 ${pluginsToInstall.length} 个插件`);
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
        if (plugin.manifest) await removeThemeFromPlugin(plugin.manifest);
        installedPlugins.value = await uninstallPlugin(plugin.id);
        catalogPlugins.value = catalogPlugins.value.filter((item) => item.id !== plugin.id);
      }
      await loadDeletedPluginIds();
      notify(`已卸载 ${pluginsToUninstall.length} 个插件`);
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
      notify(`已停用 ${pluginsToDisable.length} 个插件`);
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
    const manifest = installedPlugins.value[0];
    let themeInstalled = false;
    if (manifest) {
      try {
        themeInstalled = await addThemeFromPlugin(manifest);
      } catch (error) {
        notify(`已导入本地插件，主题读取失败：${getErrorMessage(error, '读取失败')}`);
        await loadDeletedPluginIds();
        return;
      }
    }
    await loadDeletedPluginIds();
    notify(themeInstalled ? '已导入本地主题插件，主题已加入本地主题' : '已导入本地插件');
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
