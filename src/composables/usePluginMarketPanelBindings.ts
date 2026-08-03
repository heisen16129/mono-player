import { computed, type Ref } from 'vue';
import type { PluginMarketCategory, PluginMarketItem, PluginMarketStatus } from './usePluginMarket';
import type { PluginMarketPanelListeners, PluginMarketPanelProps } from '../types/pluginManager';

interface UsePluginMarketPanelBindingsOptions {
  activeCategory: Ref<PluginMarketCategory>;
  activeScreenshot: Ref<string>;
  activeScreenshotIndex: Ref<number>;
  activeStatus: Ref<'all' | PluginMarketStatus>;
  categories: PluginMarketPanelProps['categories'];
  isInstallingPlugin: PluginMarketPanelProps['isInstallingPlugin'];
  loading: Ref<boolean>;
  localizedCapability: PluginMarketPanelProps['localizedCapability'];
  localizedPermission: PluginMarketPanelProps['localizedPermission'];
  pluginActionLabel: PluginMarketPanelProps['pluginActionLabel'];
  pluginKindLabel: PluginMarketPanelProps['pluginKindLabel'];
  pluginStatusLabel: PluginMarketPanelProps['pluginStatusLabel'];
  plugins: Ref<PluginMarketItem[]>;
  search: Ref<string>;
  selectedPlugin: Ref<PluginMarketItem | null>;
  screenshots: Ref<string[]>;
  statusFilters: PluginMarketPanelProps['statusFilters'];
  handleAction: (plugin: PluginMarketItem) => void | Promise<void>;
  selectCategory: (category: PluginMarketCategory) => void;
  selectPlugin: (plugin: PluginMarketItem) => void;
  selectScreenshot: (index: number) => void;
  showNextScreenshot: () => void;
  showPreviousScreenshot: () => void;
}

export function usePluginMarketPanelBindings({
  activeCategory,
  activeScreenshot,
  activeScreenshotIndex,
  activeStatus,
  categories,
  isInstallingPlugin,
  loading,
  localizedCapability,
  localizedPermission,
  pluginActionLabel,
  pluginKindLabel,
  pluginStatusLabel,
  plugins,
  search,
  selectedPlugin,
  screenshots,
  statusFilters,
  handleAction,
  selectCategory,
  selectPlugin,
  selectScreenshot,
  showNextScreenshot,
  showPreviousScreenshot,
}: UsePluginMarketPanelBindingsOptions) {
  const pluginMarketPanelProps = computed<PluginMarketPanelProps>(() => ({
    activeCategory: activeCategory.value,
    activeScreenshot: activeScreenshot.value,
    activeScreenshotIndex: activeScreenshotIndex.value,
    activeStatus: activeStatus.value,
    categories,
    isInstallingPlugin,
    loading: loading.value,
    localizedCapability,
    localizedPermission,
    pluginActionLabel,
    pluginKindLabel,
    pluginStatusLabel,
    plugins: plugins.value,
    search: search.value,
    selectedPlugin: selectedPlugin.value,
    screenshots: screenshots.value,
    statusFilters,
  }));

  const pluginMarketPanelListeners: PluginMarketPanelListeners = {
    onAction: handleAction,
    onNextScreenshot: showNextScreenshot,
    onPreviousScreenshot: showPreviousScreenshot,
    onSelectCategory: selectCategory,
    onSelectPlugin: selectPlugin,
    onSelectScreenshot: selectScreenshot,
    'onUpdate:activeStatus': (status) => {
      activeStatus.value = status;
    },
    'onUpdate:search': (value) => {
      search.value = value;
    },
  };

  return {
    pluginMarketPanelListeners,
    pluginMarketPanelProps,
  };
}
