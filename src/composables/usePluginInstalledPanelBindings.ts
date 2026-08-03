import { computed, type ComputedRef, type Ref } from 'vue';
import type { PluginRow } from '../components/plugin-manager/types';
import type { PluginCatalogItem, PluginManifest } from '../types/plugin';
import type { PluginCapability } from '../types/plugin';
import type { PluginInstalledPanelListeners, PluginInstalledPanelProps } from '../types/pluginManager';

interface UsePluginInstalledPanelBindingsOptions {
  allVisibleSelected: ComputedRef<boolean>;
  busy: Ref<boolean>;
  dragOverPluginId: Ref<string | null>;
  draggingPluginId: Ref<string | null>;
  enabledCount: ComputedRef<number>;
  formatCapabilities: (capabilities: PluginCapability[], installed?: boolean) => string;
  installableCount: ComputedRef<number>;
  loading: Ref<boolean>;
  plugins: ComputedRef<PluginRow[]>;
  selectedCount: ComputedRef<number>;
  selectedPluginIds: Ref<Set<string>>;
  batchDisable: () => void | Promise<void>;
  batchInstall: () => void | Promise<void>;
  batchUninstall: () => void | Promise<void>;
  install: (item: PluginCatalogItem) => void | Promise<void>;
  remove: (pluginId: string, pluginName: string) => void | Promise<void>;
  select: (pluginId: string, selected: boolean) => void;
  startDrag: (event: PointerEvent, plugin: PluginRow) => void;
  startRowDrag: (event: PointerEvent, plugin: PluginRow) => void;
  toggle: (plugin: PluginManifest) => void | Promise<void>;
  toggleAll: () => void;
  update: (item: PluginCatalogItem) => void | Promise<void>;
}

export function usePluginInstalledPanelBindings({
  allVisibleSelected,
  busy,
  dragOverPluginId,
  draggingPluginId,
  enabledCount,
  formatCapabilities,
  installableCount,
  loading,
  plugins,
  selectedCount,
  selectedPluginIds,
  batchDisable,
  batchInstall,
  batchUninstall,
  install,
  remove,
  select,
  startDrag,
  startRowDrag,
  toggle,
  toggleAll,
  update,
}: UsePluginInstalledPanelBindingsOptions) {
  const pluginInstalledPanelProps = computed<PluginInstalledPanelProps>(() => ({
    allVisibleSelected: allVisibleSelected.value,
    busy: busy.value,
    dragOverPluginId: dragOverPluginId.value,
    draggingPluginId: draggingPluginId.value,
    enabledCount: enabledCount.value,
    formatCapabilities,
    installableCount: installableCount.value,
    loading: loading.value,
    plugins: plugins.value,
    selectedCount: selectedCount.value,
    selectedPluginIds: selectedPluginIds.value,
  }));

  const pluginInstalledPanelListeners: PluginInstalledPanelListeners = {
    onBatchDisable: batchDisable,
    onBatchInstall: batchInstall,
    onBatchUninstall: batchUninstall,
    onInstall: install,
    onRemove: remove,
    onSelect: select,
    onStartDrag: startDrag,
    onStartRowDrag: startRowDrag,
    onToggle: toggle,
    onToggleAll: toggleAll,
    onUpdate: update,
  };

  return {
    pluginInstalledPanelListeners,
    pluginInstalledPanelProps,
  };
}
