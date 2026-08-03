import { ref } from 'vue';

export type PluginCenterTab = 'market' | 'installed' | 'subscriptions';

export function usePluginCenterTabs() {
  const activePluginCenterTab = ref<PluginCenterTab>('market');

  const pluginCenterTabs = [
    { id: 'market', label: '商城' },
    { id: 'installed', label: '已安装' },
    { id: 'subscriptions', label: '订阅源' },
  ];

  function selectPluginCenterTab(tab: string | null) {
    if (tab === 'market' || tab === 'installed' || tab === 'subscriptions') {
      activePluginCenterTab.value = tab;
    }
  }

  return {
    activePluginCenterTab,
    pluginCenterTabs,
    selectPluginCenterTab,
  };
}
