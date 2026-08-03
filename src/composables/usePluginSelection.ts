import { computed, ref, type ComputedRef } from 'vue';
import type { PluginRow } from '../components/plugin-manager/types';

export function usePluginSelection(visiblePlugins: ComputedRef<PluginRow[]>) {
  const selectedPluginIds = ref<Set<string>>(new Set());

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

  return {
    allVisibleSelected,
    pruneSelection,
    selectedEnabledPlugins,
    selectedInstallablePlugins,
    selectedPluginIds,
    selectedPlugins,
    setPluginSelected,
    toggleAllVisiblePlugins,
  };
}
