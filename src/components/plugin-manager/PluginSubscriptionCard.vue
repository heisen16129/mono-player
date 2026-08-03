<script setup lang="ts">
import type { PluginSubscription } from '../../types/plugin';
import PluginSubscriptionCardActions from './PluginSubscriptionCardActions.vue';
import PluginSubscriptionCardBody from './PluginSubscriptionCardBody.vue';

defineProps<{
  isSyncing: boolean;
  subscription: PluginSubscription;
}>();

const emit = defineEmits<{
  remove: [subscription: PluginSubscription];
  sync: [subscription: PluginSubscription];
}>();
</script>

<template>
  <div class="subscription-card">
    <PluginSubscriptionCardBody :name="subscription.name" :url="subscription.url" />
    <PluginSubscriptionCardActions
      :is-syncing="isSyncing"
      :name="subscription.name"
      @remove="emit('remove', subscription)"
      @sync="emit('sync', subscription)"
    />
  </div>
</template>

<style scoped>
.subscription-card {
  --subscription-actions-opacity: 0;
  --subscription-actions-pointer-events: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  max-width: min(680px, 100%);
  overflow: hidden;
  padding: 10px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-card:hover,
.subscription-card:focus-within {
  --subscription-actions-opacity: 1;
  --subscription-actions-pointer-events: auto;
}
</style>
