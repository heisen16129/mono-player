import { ref } from 'vue';
import {
  fetchPluginCatalog,
  listCachedPluginCatalog,
  listDeletedPluginIds,
  listInstalledPlugins,
  saveCachedPluginCatalog,
} from '../services/plugins';
import type { PluginCatalogItem, PluginManifest, PluginSubscription } from '../types/plugin';

const OFFICIAL_PLUGIN_CATALOG_SUBSCRIPTION: PluginSubscription = {
  id: 'official-plugin-store',
  name: '官方插件商城',
  url: 'https://raw.githubusercontent.com/heisen16129/mono-plugin-store/refs/heads/master/catalog.json',
};

export function usePluginCatalogState() {
  const installedPlugins = ref<PluginManifest[]>([]);
  const catalogPlugins = ref<PluginCatalogItem[]>([]);
  const officialCatalogPlugins = ref<PluginCatalogItem[]>([]);
  const isLoading = ref(false);
  const isLoadingOfficialCatalog = ref(false);
  const deletedPluginIds = ref<Set<string>>(new Set());
  let pruneSelection = () => {};

  function registerPluginCatalogSelectionPruner(pruner: () => void) {
    pruneSelection = pruner;
  }

  function mergeCatalogPlugins(currentPlugins: PluginCatalogItem[], nextPlugins: PluginCatalogItem[]) {
    const pluginById = new Map(currentPlugins.map((plugin) => [plugin.id, plugin]));
    for (const plugin of nextPlugins) {
      pluginById.set(plugin.id, plugin);
    }
    return [...pluginById.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
  }

  async function loadOfficialCatalog() {
    const plugins = await fetchPluginCatalog(OFFICIAL_PLUGIN_CATALOG_SUBSCRIPTION);
    officialCatalogPlugins.value = plugins;
    catalogPlugins.value = mergeCatalogPlugins(catalogPlugins.value, plugins);
    await saveCachedPluginCatalog(catalogPlugins.value);
    return plugins;
  }

  async function loadInstalledPlugins() {
    installedPlugins.value = await listInstalledPlugins();
    pruneSelection();
  }

  async function loadDeletedPluginIds() {
    deletedPluginIds.value = new Set(await listDeletedPluginIds());
    pruneSelection();
  }

  async function loadCachedCatalogPlugins() {
    catalogPlugins.value = await listCachedPluginCatalog();
    pruneSelection();
  }

  async function refreshOfficialCatalogInBackground() {
    isLoadingOfficialCatalog.value = true;
    try {
      await loadOfficialCatalog();
    } catch (error) {
      officialCatalogPlugins.value = [];
      console.warn('[PluginMarket] official catalog fetch failed', error);
    } finally {
      isLoadingOfficialCatalog.value = false;
      pruneSelection();
    }
  }

  function refreshInstalledPluginsOnFocus() {
    void Promise.all([loadInstalledPlugins(), loadDeletedPluginIds()]).catch((error) => {
      console.warn('[PluginManager] installed plugin refresh failed', error);
    });
  }

  function startPluginCatalogFocusRefresh() {
    window.addEventListener('focus', refreshInstalledPluginsOnFocus);
  }

  function stopPluginCatalogFocusRefresh() {
    window.removeEventListener('focus', refreshInstalledPluginsOnFocus);
  }

  return {
    catalogPlugins,
    deletedPluginIds,
    installedPlugins,
    isLoading,
    isLoadingOfficialCatalog,
    officialCatalogPlugins,
    loadCachedCatalogPlugins,
    loadDeletedPluginIds,
    loadInstalledPlugins,
    mergeCatalogPlugins,
    registerPluginCatalogSelectionPruner,
    refreshOfficialCatalogInBackground,
    startPluginCatalogFocusRefresh,
    stopPluginCatalogFocusRefresh,
  };
}
