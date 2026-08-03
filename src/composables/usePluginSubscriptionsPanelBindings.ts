import { computed, type Ref } from 'vue';
import type { PluginSubscription } from '../types/plugin';
import type { PluginSubscriptionsPanelListeners, PluginSubscriptionsPanelProps } from '../types/pluginManager';

interface UsePluginSubscriptionsPanelBindingsOptions {
  adding: Ref<boolean>;
  isSyncingSubscription: (subscriptionId: string) => boolean;
  modelValue: Ref<string>;
  subscriptions: Ref<PluginSubscription[]>;
  add: () => void | Promise<void>;
  importLocalFile: () => void | Promise<void>;
  remove: (subscription: PluginSubscription) => void | Promise<void>;
  sync: (subscription: PluginSubscription) => void | Promise<void>;
}

export function usePluginSubscriptionsPanelBindings({
  adding,
  isSyncingSubscription,
  modelValue,
  subscriptions,
  add,
  importLocalFile,
  remove,
  sync,
}: UsePluginSubscriptionsPanelBindingsOptions) {
  const pluginSubscriptionsPanelProps = computed<PluginSubscriptionsPanelProps>(() => ({
    adding: adding.value,
    isSyncingSubscription,
    modelValue: modelValue.value,
    subscriptions: subscriptions.value,
  }));

  const pluginSubscriptionsPanelListeners: PluginSubscriptionsPanelListeners = {
    onAdd: add,
    onImportLocalFile: importLocalFile,
    onRemove: remove,
    onSync: sync,
    'onUpdate:modelValue': (value) => {
      modelValue.value = value;
    },
  };

  return {
    pluginSubscriptionsPanelListeners,
    pluginSubscriptionsPanelProps,
  };
}
