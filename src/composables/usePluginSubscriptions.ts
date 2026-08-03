import { ref, type ComputedRef, type Ref } from 'vue';
import {
  addPluginSubscription,
  fetchAllPluginCatalogs,
  fetchPluginCatalog,
  listPluginSubscriptions,
  restoreDeletedPluginsFromCatalog,
  saveCachedPluginCatalog,
  savePluginSubscriptions,
} from '../services/plugins';
import type { PluginCatalogItem, PluginSubscription } from '../types/plugin';
import type { PluginRow } from '../components/plugin-manager/types';
import { getErrorMessage } from '../utils/error';

interface UsePluginSubscriptionsOptions {
  catalogPlugins: Ref<PluginCatalogItem[]>;
  loadDeletedPluginIds: () => Promise<void>;
  mergeCatalogPlugins: (currentPlugins: PluginCatalogItem[], nextPlugins: PluginCatalogItem[]) => PluginCatalogItem[];
  notify: (message: string) => void;
  officialCatalogPlugins: Ref<PluginCatalogItem[]>;
  pruneSelection: () => void;
  visiblePlugins: ComputedRef<PluginRow[]>;
}

export function usePluginSubscriptions({
  catalogPlugins,
  loadDeletedPluginIds,
  mergeCatalogPlugins,
  notify,
  officialCatalogPlugins,
  pruneSelection,
  visiblePlugins,
}: UsePluginSubscriptionsOptions) {
  const subscriptions = ref<PluginSubscription[]>([]);
  const subscriptionUrl = ref('');
  const isAddingSubscription = ref(false);
  const syncingSubscriptionIds = ref<Set<string>>(new Set());

  async function loadSubscriptions() {
    subscriptions.value = await listPluginSubscriptions();
  }

  function isSyncingSubscription(subscriptionId: string) {
    return syncingSubscriptionIds.value.has(subscriptionId);
  }

  function setSyncingSubscription(subscriptionId: string, syncing: boolean) {
    const nextSubscriptionIds = new Set(syncingSubscriptionIds.value);
    if (syncing) {
      nextSubscriptionIds.add(subscriptionId);
    } else {
      nextSubscriptionIds.delete(subscriptionId);
    }
    syncingSubscriptionIds.value = nextSubscriptionIds;
  }

  async function addSubscription() {
    const url = subscriptionUrl.value.trim();
    if (!url || isAddingSubscription.value) return;

    isAddingSubscription.value = true;

    try {
      subscriptions.value = await addPluginSubscription(url);
      const subscription = subscriptions.value.find((item) => item.url === url);
      if (!subscription) throw new Error('订阅保存失败');
      const addedPlugins = await fetchPluginCatalog(subscription);
      catalogPlugins.value = mergeCatalogPlugins(catalogPlugins.value, addedPlugins);
      await saveCachedPluginCatalog(catalogPlugins.value);
      await restoreDeletedPluginsFromCatalog(addedPlugins);
      await loadDeletedPluginIds();
      const visibleCount = visiblePlugins.value.length;
      notify(`已添加 ${addedPlugins.length} 个插件，当前共 ${visibleCount} 个可显示插件`);
    } catch (error) {
      notify(`订阅失败：${getErrorMessage(error, '订阅失败')}`);
    } finally {
      isAddingSubscription.value = false;
    }
  }

  async function removeSubscription(subscription: PluginSubscription) {
    const nextSubscriptions = subscriptions.value.filter((item) => item.id !== subscription.id);
    subscriptions.value = nextSubscriptions;
    await savePluginSubscriptions(nextSubscriptions);

    try {
      const subscriptionPlugins = await fetchAllPluginCatalogs(nextSubscriptions);
      catalogPlugins.value = mergeCatalogPlugins(officialCatalogPlugins.value, subscriptionPlugins);
      await saveCachedPluginCatalog(catalogPlugins.value);
      notify(`已删除订阅 ${subscription.name}`);
    } catch (error) {
      catalogPlugins.value = officialCatalogPlugins.value;
      await saveCachedPluginCatalog(catalogPlugins.value);
      notify(`已删除订阅 ${subscription.name}，剩余订阅刷新失败：${getErrorMessage(error, '刷新失败')}`);
    } finally {
      pruneSelection();
    }
  }

  async function syncSubscription(subscription: PluginSubscription) {
    if (isSyncingSubscription(subscription.id)) return;
    setSyncingSubscription(subscription.id, true);
    notify(`正在同步订阅 ${subscription.name}`);

    try {
      const syncedPlugins = await fetchPluginCatalog(subscription);
      catalogPlugins.value = mergeCatalogPlugins(catalogPlugins.value, syncedPlugins);
      await saveCachedPluginCatalog(catalogPlugins.value);
      await restoreDeletedPluginsFromCatalog(syncedPlugins);
      await loadDeletedPluginIds();
      notify(`已同步订阅 ${subscription.name}，更新 ${syncedPlugins.length} 个插件`);
    } catch (error) {
      notify(`同步订阅失败：${getErrorMessage(error, '同步失败')}`);
    } finally {
      setSyncingSubscription(subscription.id, false);
      pruneSelection();
    }
  }

  return {
    addSubscription,
    isAddingSubscription,
    isSyncingSubscription,
    loadSubscriptions,
    removeSubscription,
    subscriptions,
    subscriptionUrl,
    syncSubscription,
  };
}
