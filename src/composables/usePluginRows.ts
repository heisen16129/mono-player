import { computed } from 'vue';
import type { PluginCatalogItem, PluginManifest } from '../types/plugin';
import type { PluginRow } from '../components/plugin-manager/types';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UsePluginRowsOptions {
  catalogPlugins: ReadonlyRefValue<PluginCatalogItem[]>;
  deletedPluginIds: ReadonlyRefValue<Set<string>>;
  installedPlugins: ReadonlyRefValue<PluginManifest[]>;
}

export function usePluginRows({
  catalogPlugins,
  deletedPluginIds,
  installedPlugins,
}: UsePluginRowsOptions) {
  const visiblePlugins = computed<PluginRow[]>(() => {
    const catalogById = new Map(catalogPlugins.value.map((plugin) => [plugin.id, plugin]));
    const installedRows = installedPlugins.value.map((plugin) => {
      const catalogItem = catalogById.get(plugin.id) ?? null;

      return {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        author: plugin.author ?? '',
        runtime: plugin.runtime,
        capabilities: plugin.capabilities,
        installed: true,
        enabled: plugin.enabled,
        catalogItem,
        manifest: plugin,
      };
    });
    return installedRows.filter((plugin) => !deletedPluginIds.value.has(plugin.id));
  });

  return {
    visiblePlugins,
  };
}
