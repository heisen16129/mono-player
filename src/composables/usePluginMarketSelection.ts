import { computed, ref, watch, type ComputedRef } from 'vue';
import type { PluginMarketCategory, PluginMarketItem } from './usePluginMarket';

interface UsePluginMarketSelectionOptions {
  activeMarketCategory: { value: PluginMarketCategory };
  filteredMarketPlugins: ComputedRef<PluginMarketItem[]>;
}

export function usePluginMarketSelection({ activeMarketCategory, filteredMarketPlugins }: UsePluginMarketSelectionOptions) {
  const selectedMarketPluginId = ref('');
  const activeScreenshotIndex = ref(0);

  const selectedMarketPlugin = computed(() => {
    const selected = filteredMarketPlugins.value.find((plugin) => plugin.id === selectedMarketPluginId.value);
    return selected ?? filteredMarketPlugins.value[0] ?? null;
  });

  const selectedPluginScreenshots = computed(() => selectedMarketPlugin.value?.screenshots?.slice(0, 5) ?? []);
  const activePluginScreenshot = computed(() => selectedPluginScreenshots.value[activeScreenshotIndex.value] ?? '');

  watch(selectedMarketPluginId, () => {
    activeScreenshotIndex.value = 0;
  });

  function selectScreenshot(index: number) {
    if (index < 0 || index >= selectedPluginScreenshots.value.length) return;
    activeScreenshotIndex.value = index;
  }

  function showPreviousScreenshot() {
    const total = selectedPluginScreenshots.value.length;
    if (total <= 1) return;
    activeScreenshotIndex.value = (activeScreenshotIndex.value + total - 1) % total;
  }

  function showNextScreenshot() {
    const total = selectedPluginScreenshots.value.length;
    if (total <= 1) return;
    activeScreenshotIndex.value = (activeScreenshotIndex.value + 1) % total;
  }

  function selectMarketCategory(category: PluginMarketCategory) {
    activeMarketCategory.value = category;
    const nextPlugin = filteredMarketPlugins.value[0];
    selectedMarketPluginId.value = nextPlugin?.id ?? '';
  }

  function selectMarketPlugin(plugin: PluginMarketItem) {
    selectedMarketPluginId.value = plugin.id;
  }

  return {
    activePluginScreenshot,
    activeScreenshotIndex,
    selectMarketCategory,
    selectMarketPlugin,
    selectedMarketPlugin,
    selectedMarketPluginId,
    selectedPluginScreenshots,
    selectScreenshot,
    showNextScreenshot,
    showPreviousScreenshot,
  };
}
