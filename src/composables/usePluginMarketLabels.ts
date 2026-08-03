import type { ComputedRef, Ref } from 'vue';
import type { PluginMarketCategory, PluginMarketItem, PluginMarketStatus } from './usePluginMarket';
import { marketCategories } from './usePluginMarket';

interface UsePluginMarketLabelsOptions {
  appLocale: ComputedRef<string>;
  installingPluginIds: Ref<Set<string>>;
}

export function usePluginMarketLabels({ appLocale, installingPluginIds }: UsePluginMarketLabelsOptions) {
  function localizedCapability(capability: string) {
    if (appLocale.value !== 'zh-CN') return capability;
    const labels: Record<string, string> = {
      search: '搜索歌曲',
      play: '在线播放',
      lyrics: '歌词获取',
      metadata: '元数据',
      cover: '封面',
      album: '专辑',
      'playlist-import': '导入歌单',
      'playlist-export': '导出歌单',
      theme: '主题',
      scrobble: '播放记录同步',
      'history-sync': '历史同步',
      'batch-rename': '批量重命名',
      'lyric-convert': '歌词转换',
      'lyric-translate': '歌词翻译',
    };
    return labels[capability] ?? capability;
  }

  function localizedPermission(permission: string) {
    if (appLocale.value !== 'zh-CN') return permission;
    const labels: Record<string, string> = {
      network: '网络',
      'credential-read': '读取凭据',
      'cache-read': '读取缓存',
      'cache-write': '写入缓存',
      'download-write': '写入下载目录',
    };
    return labels[permission] ?? permission;
  }

  function pluginKindLabel(kind: PluginMarketCategory) {
    return marketCategories.find((category) => category.id === kind)?.label ?? kind;
  }

  function pluginStatusLabel(status: PluginMarketStatus) {
    if (status === 'installed') return '已安装';
    if (status === 'update') return '可更新';
    return '可安装';
  }

  function pluginActionLabel(plugin: PluginMarketItem) {
    if (installingPluginIds.value.has(plugin.id)) return plugin.status === 'update' ? '更新中' : '安装中';
    if (plugin.status === 'installed') return '已安装';
    if (plugin.status === 'update') return '更新';
    return '安装';
  }

  return {
    localizedCapability,
    localizedPermission,
    pluginActionLabel,
    pluginKindLabel,
    pluginStatusLabel,
  };
}
