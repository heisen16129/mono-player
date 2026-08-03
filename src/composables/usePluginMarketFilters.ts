import { computed, ref, type ComputedRef } from 'vue';
import type { PluginMarketCategory, PluginMarketItem, PluginMarketStatus } from './usePluginMarket';

interface UsePluginMarketFiltersOptions {
  localizedCapability: (capability: string) => string;
  marketPlugins: ComputedRef<PluginMarketItem[]>;
}

export function usePluginMarketFilters({ localizedCapability, marketPlugins }: UsePluginMarketFiltersOptions) {
  const activeMarketCategory = ref<PluginMarketCategory>('all');
  const marketSearch = ref('');
  const activeMarketStatus = ref<'all' | PluginMarketStatus>('all');

  const filteredMarketPlugins = computed(() => {
    const keyword = marketSearch.value.trim().toLowerCase();
    return marketPlugins.value.filter((plugin) => {
      const matchesCategory = activeMarketCategory.value === 'all' || plugin.kind === activeMarketCategory.value;
      const matchesStatus = activeMarketStatus.value === 'all' || plugin.status === activeMarketStatus.value;
      const matchesKeyword = !keyword || [
        plugin.name,
        plugin.author,
        plugin.description,
        plugin.kind,
        plugin.runtime,
        ...plugin.capabilities,
        ...plugin.capabilities.map(localizedCapability),
        ...plugin.tags,
      ].some((value) => value.toLowerCase().includes(keyword));

      return matchesCategory && matchesStatus && matchesKeyword;
    });
  });

  return {
    activeMarketCategory,
    activeMarketStatus,
    filteredMarketPlugins,
    marketSearch,
  };
}
