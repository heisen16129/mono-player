<script setup lang="ts">
import { useScrollingState } from '../../composables/useScrollingState';
import type { PluginMarketItem } from '../../composables/usePluginMarket';
import PluginDetailCapabilityList from './PluginDetailCapabilityList.vue';
import PluginDetailDescription from './PluginDetailDescription.vue';
import PluginDetailHeading from './PluginDetailHeading.vue';
import PluginDetailHighlights from './PluginDetailHighlights.vue';
import PluginDetailMeta from './PluginDetailMeta.vue';
import PluginDetailPermissionList from './PluginDetailPermissionList.vue';
import PluginDetailPrimaryAction from './PluginDetailPrimaryAction.vue';
import PluginDetailScreenshots from './PluginDetailScreenshots.vue';

defineProps<{
  activeScreenshot: string;
  activeScreenshotIndex: number;
  isInstallingPlugin: (pluginId: string) => boolean;
  localizedCapability: (capability: string) => string;
  localizedPermission: (permission: string) => string;
  plugin: PluginMarketItem;
  pluginActionLabel: (plugin: PluginMarketItem) => string;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
  screenshots: string[];
}>();

defineEmits<{
  action: [plugin: PluginMarketItem];
  nextScreenshot: [];
  previousScreenshot: [];
  selectScreenshot: [index: number];
}>();

const { isScrolling, showScrolling } = useScrollingState();
</script>

<template>
  <aside class="plugin-detail-panel transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" aria-label="插件详情" @scroll="showScrolling">
    <PluginDetailHeading :plugin="plugin" :plugin-kind-label="pluginKindLabel" />

    <PluginDetailPrimaryAction
      :is-installing="isInstallingPlugin(plugin.id)"
      :label="pluginActionLabel(plugin)"
      :plugin="plugin"
      @action="$emit('action', $event)"
    />

    <PluginDetailDescription :description="plugin.description" />

    <PluginDetailCapabilityList :capabilities="plugin.capabilities" :localized-capability="localizedCapability" />

    <PluginDetailPermissionList :localized-permission="localizedPermission" :permissions="plugin.permissions" />

    <PluginDetailHighlights :highlights="plugin.highlights" />

    <PluginDetailMeta :plugin="plugin" />

    <PluginDetailScreenshots
      :active-screenshot="activeScreenshot"
      :active-screenshot-index="activeScreenshotIndex"
      :screenshots="screenshots"
      @next="$emit('nextScreenshot')"
      @previous="$emit('previousScreenshot')"
      @select="$emit('selectScreenshot', $event)"
    />
  </aside>
</template>

<style scoped>
.plugin-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-input);
}

@media (max-width: 1180px) {
  .plugin-detail-panel {
    display: none;
  }
}
</style>
