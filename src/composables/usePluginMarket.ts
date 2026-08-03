import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { PluginCatalogItem, PluginManifest } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import { isMarketPluginKind, toRealMarketPlugin } from './pluginMarketItems';
import { usePluginMarketFilters } from './usePluginMarketFilters';
import { usePluginMarketLabels } from './usePluginMarketLabels';
import { usePluginMarketSelection } from './usePluginMarketSelection';

export type PluginMarketCategory = 'all' | 'music' | 'lyrics' | 'metadata' | 'playlist' | 'theme' | 'integration' | 'tool';
export type PluginMarketKind = Exclude<PluginMarketCategory, 'all'>;
export type PluginMarketStatus = 'available' | 'installed' | 'update';

export interface PluginMarketItem {
  id: string;
  name: string;
  author: string;
  version: string;
  installedVersion?: string;
  icon?: string;
  kind: PluginMarketKind;
  runtime: string;
  capabilities: string[];
  permissions: string[];
  description: string;
  source: string;
  minAppVersion?: string;
  updatedAt: string;
  status: PluginMarketStatus;
  tags: string[];
  highlights: string[];
  screenshots?: string[];
  catalogItem: PluginCatalogItem | null;
  manifest: PluginManifest | null;
}

interface UsePluginMarketOptions {
  appLocale: ComputedRef<string>;
  installedPlugins: Ref<PluginManifest[]>;
  notify: (message: string) => void;
  officialCatalogPlugins: Ref<PluginCatalogItem[]>;
  onInstallPlugin: (item: PluginCatalogItem) => Promise<void>;
  onUpdatePlugin: (item: PluginCatalogItem) => Promise<void>;
}

export const marketStatusFilters = [
  { id: 'all', label: '全部' },
  { id: 'available', label: '可安装' },
  { id: 'installed', label: '已安装' },
  { id: 'update', label: '可更新' },
] satisfies Array<{ id: 'all' | PluginMarketStatus; label: string }>;

export const marketCategories = [
  { id: 'all', label: '全部', description: '显示全部插件' },
  { id: 'music', label: '音源', description: '搜索和播放在线音乐' },
  { id: 'lyrics', label: '歌词', description: '搜索、匹配和处理歌词' },
  { id: 'metadata', label: '元数据', description: '补全封面、专辑和曲目信息' },
  { id: 'playlist', label: '歌单', description: '导入和导出歌单' },
  { id: 'theme', label: '主题', description: '安装播放器主题资源包' },
  { id: 'integration', label: '集成', description: '连接外部服务' },
  { id: 'tool', label: '工具', description: '批处理和辅助工具' },
] satisfies Array<{ id: PluginMarketCategory; label: string; description: string }>;

export function usePluginMarket({ appLocale, installedPlugins, notify, officialCatalogPlugins, onInstallPlugin, onUpdatePlugin }: UsePluginMarketOptions) {
  const installingPluginIds = ref<Set<string>>(new Set());

  const {
    localizedCapability,
    localizedPermission,
    pluginActionLabel,
    pluginKindLabel,
    pluginStatusLabel,
  } = usePluginMarketLabels({ appLocale, installingPluginIds });

  const realMarketPlugins = computed(() => {
    const catalogById = new Map(officialCatalogPlugins.value.map((plugin) => [plugin.id, plugin]));
    const installedById = new Map(installedPlugins.value.map((plugin) => [plugin.id, plugin]));

    return [...catalogById.keys()]
      .map((pluginId) => toRealMarketPlugin(catalogById.get(pluginId) ?? null, installedById.get(pluginId) ?? null))
      .filter((plugin): plugin is PluginMarketItem => plugin !== null && isMarketPluginKind(plugin.kind));
  });

  const marketPlugins = computed<PluginMarketItem[]>(() => realMarketPlugins.value);

  const { activeMarketCategory, activeMarketStatus, filteredMarketPlugins, marketSearch } = usePluginMarketFilters({
    localizedCapability,
    marketPlugins,
  });

  const {
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
  } = usePluginMarketSelection({ activeMarketCategory, filteredMarketPlugins });

  function isInstallingPlugin(pluginId: string) {
    return installingPluginIds.value.has(pluginId);
  }

  function setInstallingPlugin(pluginId: string, installing: boolean) {
    const nextPluginIds = new Set(installingPluginIds.value);
    if (installing) {
      nextPluginIds.add(pluginId);
    } else {
      nextPluginIds.delete(pluginId);
    }
    installingPluginIds.value = nextPluginIds;
  }

  function handleMarketPluginAction(plugin: PluginMarketItem) {
    if (plugin.status === 'installed') return;
    if (isInstallingPlugin(plugin.id)) return;
    if (!plugin.catalogItem) {
      notify('该插件暂未接入安装包');
      return;
    }

    const actionLabel = plugin.status === 'update' ? '更新' : '安装';
    const action = plugin.status === 'update' ? onUpdatePlugin : onInstallPlugin;
    setInstallingPlugin(plugin.id, true);
    notify(`正在后台${actionLabel} ${plugin.name}`);
    void action(plugin.catalogItem)
      .catch((error) => {
        notify(`${actionLabel}失败：${getErrorMessage(error, '插件安装失败')}`);
      })
      .finally(() => setInstallingPlugin(plugin.id, false));
  }

  return {
    activeMarketCategory,
    activeMarketStatus,
    activePluginScreenshot,
    activeScreenshotIndex,
    filteredMarketPlugins,
    handleMarketPluginAction,
    isInstallingPlugin,
    localizedCapability,
    localizedPermission,
    marketCategories,
    marketPlugins,
    marketSearch,
    marketStatusFilters,
    pluginActionLabel,
    pluginKindLabel,
    pluginStatusLabel,
    realMarketPlugins,
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
