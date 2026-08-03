<script setup lang="ts">
import { Info, RefreshCw } from '@lucide/vue';
import { useScrollingState } from '../../composables/useScrollingState';
import type { PluginMarketItem, PluginMarketStatus } from '../../composables/usePluginMarket';
import PluginMarketCard from './PluginMarketCard.vue';

defineProps<{
  isInstallingPlugin: (pluginId: string) => boolean;
  loading: boolean;
  pluginActionLabel: (plugin: PluginMarketItem) => string;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
  pluginStatusLabel: (status: PluginMarketStatus) => string;
  plugins: PluginMarketItem[];
  selectedPluginId: string;
}>();

const emit = defineEmits<{
  action: [plugin: PluginMarketItem];
  select: [plugin: PluginMarketItem];
}>();

const { isScrolling, showScrolling } = useScrollingState();
</script>

<template>
  <div class="plugin-market-list transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" aria-label="插件列表" @scroll="showScrolling">
    <div v-if="loading" class="plugin-market-empty">
      <RefreshCw class="spinning" :size="18" />
      <span>正在加载官方插件</span>
    </div>

    <template v-else>
      <PluginMarketCard
        v-for="plugin in plugins"
        :key="plugin.id"
        :action-label="pluginActionLabel(plugin)"
        :is-installing="isInstallingPlugin(plugin.id)"
        :is-selected="selectedPluginId === plugin.id"
        :plugin="plugin"
        :plugin-kind-label="pluginKindLabel"
        :plugin-status-label="pluginStatusLabel"
        @action="emit('action', $event)"
        @select="emit('select', $event)"
      />
    </template>

    <div v-if="!loading && plugins.length === 0" class="plugin-market-empty">
      <Info :size="18" />
      <span>没有找到匹配的插件</span>
    </div>
  </div>
</template>

<style scoped>
.plugin-market-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.plugin-market-empty {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  border: 1px dashed var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
