import { ref, type ComputedRef, type Ref } from 'vue';
import { pluginCatalog, listPluginSubscriptions, type PluginCatalogSnapshot } from '../services/plugins';
import type { PluginCatalogItem, PluginSubscription } from '../types/plugin';
import type { PluginRow } from '../components/plugin-manager/types';
import { getErrorMessage } from '../utils/error';

interface UsePluginSubscriptionsOptions {
  catalogPlugins: Ref<PluginCatalogItem[]>;
  loadDeletedPluginIds: () => Promise<void>;
  notify: (message: string) => void;
  officialCatalogPlugins: Ref<PluginCatalogItem[]>;
  pruneSelection: () => void;
  visiblePlugins: ComputedRef<PluginRow[]>;
}

export function usePluginSubscriptions({
  catalogPlugins,
  loadDeletedPluginIds,
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
      await applySnapshot(await pluginCatalog('add', undefined, url));
      notify(`订阅已保存，当前共 ${visiblePlugins.value.length} 个可显示插件`);
    } catch (error) {
      notify(`订阅失败：${getErrorMessage(error, '订阅失败')}`);
    } finally {
      isAddingSubscription.value = false;
    }
  }

  async function applySnapshot(result: PluginCatalogSnapshot) {
    subscriptions.value = result.subscriptions;
    catalogPlugins.value = result.catalog;
    officialCatalogPlugins.value = result.official;
    await loadDeletedPluginIds();
    pruneSelection();
    if (result.errors.length) throw new Error(result.errors.map(e => `${e.url}：${e.error}`).join('；'));
  }

  async function removeSubscription(subscription: PluginSubscription) {
    try {
      await applySnapshot(await pluginCatalog('remove', subscription.id));
      notify(`已删除订阅 ${subscription.name}`);
    } catch (error) {
      notify(`删除订阅失败：${getErrorMessage(error, '删除失败')}`);
    }
  }

  async function syncSubscription(subscription: PluginSubscription) {
    if (isSyncingSubscription(subscription.id)) return;
    setSyncingSubscription(subscription.id, true);
    notify(`正在同步订阅 ${subscription.name}`);

    try {
      await applySnapshot(await pluginCatalog('refresh', subscription.id));
      notify(`已同步订阅 ${subscription.name}`);
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
