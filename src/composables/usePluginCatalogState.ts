import { ref } from 'vue';
import { pluginCatalog, listInstalledPlugins } from '../services/plugins';
import type { PluginCatalogItem, PluginManifest } from '../types/plugin';

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

  async function loadOfficialCatalog() {
    const result = await pluginCatalog('refresh', 'official-plugin-store');
    officialCatalogPlugins.value = result.official;
    catalogPlugins.value = result.catalog;
    if (result.errors.length) throw new Error(result.errors.map(e => e.error).join('；'));
  }

  async function loadInstalledPlugins() {
    installedPlugins.value = await listInstalledPlugins();
    pruneSelection();
  }

  async function loadDeletedPluginIds() {
    const result = await pluginCatalog();
    deletedPluginIds.value = new Set(result.deletedIds);
    catalogPlugins.value = result.catalog;
    officialCatalogPlugins.value = result.official;
    pruneSelection();
  }

  async function loadCachedCatalogPlugins() {
    const result = await pluginCatalog();
    catalogPlugins.value = result.catalog;
    officialCatalogPlugins.value = result.official;
    pruneSelection();
  }

  async function refreshOfficialCatalogInBackground() {
    isLoadingOfficialCatalog.value = true;
    try {
      await loadOfficialCatalog();
    } catch (error) {
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
    registerPluginCatalogSelectionPruner,
    refreshOfficialCatalogInBackground,
    startPluginCatalogFocusRefresh,
    stopPluginCatalogFocusRefresh,
  };
}
