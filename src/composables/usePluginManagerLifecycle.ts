import { onBeforeUnmount, onMounted } from 'vue';

interface PluginManagerLifecycleOptions {
  loadCachedCatalogPlugins: () => Promise<void>;
  loadDeletedPluginIds: () => Promise<void>;
  loadInstalledPlugins: () => Promise<void>;
  loadSubscriptions: () => Promise<void>;
  refreshOfficialCatalogInBackground: () => Promise<void> | void;
  resetPluginPointerDragState: () => void;
  startPluginCatalogFocusRefresh: () => void;
  stopPluginCatalogFocusRefresh: () => void;
}

export function usePluginManagerLifecycle(options: PluginManagerLifecycleOptions) {
  onMounted(async () => {
    await options.loadInstalledPlugins();
    await options.loadDeletedPluginIds();
    await options.loadSubscriptions();
    await options.loadCachedCatalogPlugins();
    void options.refreshOfficialCatalogInBackground();
    options.startPluginCatalogFocusRefresh();
  });

  onBeforeUnmount(() => {
    options.stopPluginCatalogFocusRefresh();
    options.resetPluginPointerDragState();
  });
}
