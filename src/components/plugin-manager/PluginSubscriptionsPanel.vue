<script setup lang="ts">
import { FolderInput } from '@lucide/vue';
import { useScrollingState } from '../../composables/useScrollingState';
import type { PluginSubscriptionsPanelEmits, PluginSubscriptionsPanelProps } from '../../types/pluginManager';
import PluginSubscriptionCard from './PluginSubscriptionCard.vue';
import PluginSubscriptionForm from './PluginSubscriptionForm.vue';

defineProps<PluginSubscriptionsPanelProps>();

const emit = defineEmits<PluginSubscriptionsPanelEmits>();

const { isScrolling, showScrolling } = useScrollingState();
</script>

<template>
  <div class="plugin-subscriptions-panel transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" @scroll="showScrolling">
    <PluginSubscriptionForm :model-value="modelValue" :adding="adding" @update:model-value="emit('update:modelValue', $event)" @add="emit('add')">
      <template #actions>
        <button class="secondary-button plugin-local-install-button" type="button" @click="emit('importLocalFile')">
          <FolderInput :size="16" />
          从本地文件安装
        </button>
      </template>
    </PluginSubscriptionForm>

    <div class="subscription-list visible">
      <PluginSubscriptionCard
        v-for="subscription in subscriptions"
        :key="subscription.id"
        :is-syncing="isSyncingSubscription(subscription.id)"
        :subscription="subscription"
        @remove="emit('remove', $event)"
        @sync="emit('sync', $event)"
      />
      <div v-if="subscriptions.length === 0" class="subscription-empty">
        <strong>暂无订阅</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-subscriptions-panel {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.plugin-local-install-button {
  height: 36px;
}

.subscription-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, max-content));
  gap: 8px 10px;
  align-items: start;
  flex: 1;
  margin: 2px 0 10px;
  min-height: 0;
}

.subscription-list:not(.visible) {
  display: none;
}

.subscription-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  color: var(--smw-text-secondary);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.subscription-empty strong {
  color: var(--smw-text-secondary);
  font-size: 13px;
  font-weight: 560;
}
</style>
