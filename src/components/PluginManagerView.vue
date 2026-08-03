<script setup lang="ts">
import { computed } from 'vue';
import { usePluginCatalogState } from '../composables/usePluginCatalogState';
import { usePluginCenterTabs } from '../composables/usePluginCenterTabs';
import { usePluginDragSort } from '../composables/usePluginDragSort';
import { usePluginInstallActions } from '../composables/usePluginInstallActions';
import { usePluginInstalledPanelBindings } from '../composables/usePluginInstalledPanelBindings';
import { usePluginMarket } from '../composables/usePluginMarket';
import { usePluginMarketPanelBindings } from '../composables/usePluginMarketPanelBindings';
import { usePluginManagerLifecycle } from '../composables/usePluginManagerLifecycle';
import { usePluginManagerPresentation } from '../composables/usePluginManagerPresentation';
import { usePluginRows } from '../composables/usePluginRows';
import { usePluginSelection } from '../composables/usePluginSelection';
import { usePluginSubscriptions } from '../composables/usePluginSubscriptions';
import { usePluginSubscriptionsPanelBindings } from '../composables/usePluginSubscriptionsPanelBindings';
import { resolveLocale } from '../i18n';
import { usePlayerStore } from '../stores/player';
import PluginInstalledPanel from './plugin-manager/PluginInstalledPanel.vue';
import PluginCenterTabs from './plugin-manager/PluginCenterTabs.vue';
import PluginLoadingOverlay from './plugin-manager/PluginLoadingOverlay.vue';
import PluginManagerHeader from './plugin-manager/PluginManagerHeader.vue';
import PluginMarketPanel from './plugin-manager/PluginMarketPanel.vue';
import PluginSubscriptionsPanel from './plugin-manager/PluginSubscriptionsPanel.vue';

const player = usePlayerStore();
const appLocale = computed(() => resolveLocale(player.settings.locale));

const emit = defineEmits<{
  notify: [message: string, variant?: 'success' | 'error'];
}>();

const {
  createFormatCapabilities,
  notifyPlugin,
} = usePluginManagerPresentation({
  notify: (message, variant) => emit('notify', message, variant),
});

const {
  activePluginCenterTab,
  pluginCenterTabs,
  selectPluginCenterTab,
} = usePluginCenterTabs();

const {
  catalogPlugins,
  deletedPluginIds,
  installedPlugins,
  isLoading,
  isLoadingOfficialCatalog,
  officialCatalogPlugins,
  loadCachedCatalogPlugins,
  loadDeletedPluginIds,
  loadInstalledPlugins,
  mergeCatalogPlugins,
  refreshOfficialCatalogInBackground,
  registerPluginCatalogSelectionPruner,
  startPluginCatalogFocusRefresh,
  stopPluginCatalogFocusRefresh,
} = usePluginCatalogState();

const {
  visiblePlugins,
} = usePluginRows({
  catalogPlugins,
  deletedPluginIds,
  installedPlugins,
});

const {
  allVisibleSelected,
  pruneSelection,
  selectedEnabledPlugins,
  selectedInstallablePlugins,
  selectedPluginIds,
  selectedPlugins,
  setPluginSelected,
  toggleAllVisiblePlugins,
} = usePluginSelection(visiblePlugins);
registerPluginCatalogSelectionPruner(pruneSelection);

const {
  batchDisableSelected,
  batchInstallSelected,
  batchUninstallSelected,
  importFromLocalFile,
  installPlugin,
  isBatchBusy,
  removePlugin,
  togglePlugin,
  updatePlugin,
} = usePluginInstallActions({
  catalogPlugins,
  installedPlugins,
  loadDeletedPluginIds,
  notify: notifyPlugin,
  pruneSelection,
  selectedEnabledPlugins,
  selectedInstallablePlugins,
  selectedPlugins,
});

const {
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
  marketSearch,
  marketStatusFilters,
  pluginActionLabel,
  pluginKindLabel,
  pluginStatusLabel,
  selectMarketCategory,
  selectMarketPlugin,
  selectedMarketPlugin,
  selectedPluginScreenshots,
  selectScreenshot,
  showNextScreenshot,
  showPreviousScreenshot,
} = usePluginMarket({
  appLocale,
  installedPlugins,
  notify: notifyPlugin,
  officialCatalogPlugins,
  onInstallPlugin: installPlugin,
  onUpdatePlugin: updatePlugin,
});
const formatCapabilities = createFormatCapabilities(localizedCapability);

const { pluginMarketPanelListeners, pluginMarketPanelProps } = usePluginMarketPanelBindings({
  activeCategory: activeMarketCategory,
  activeScreenshot: activePluginScreenshot,
  activeScreenshotIndex,
  activeStatus: activeMarketStatus,
  categories: marketCategories,
  isInstallingPlugin,
  loading: isLoadingOfficialCatalog,
  localizedCapability,
  localizedPermission,
  pluginActionLabel,
  pluginKindLabel,
  pluginStatusLabel,
  plugins: filteredMarketPlugins,
  search: marketSearch,
  selectedPlugin: selectedMarketPlugin,
  screenshots: selectedPluginScreenshots,
  statusFilters: marketStatusFilters,
  handleAction: handleMarketPluginAction,
  selectCategory: selectMarketCategory,
  selectPlugin: selectMarketPlugin,
  selectScreenshot,
  showNextScreenshot,
  showPreviousScreenshot,
});

const {
  dragOverPluginId,
  draggingPluginId,
  resetPluginPointerDragState,
  startPluginPointerDrag,
  startPluginRowPointerDrag,
} = usePluginDragSort({
  installedPlugins,
  notify: notifyPlugin,
  visiblePlugins,
});

const { pluginInstalledPanelListeners, pluginInstalledPanelProps } = usePluginInstalledPanelBindings({
  allVisibleSelected,
  busy: isBatchBusy,
  dragOverPluginId,
  draggingPluginId,
  enabledCount: computed(() => selectedEnabledPlugins.value.length),
  formatCapabilities,
  installableCount: computed(() => selectedInstallablePlugins.value.length),
  loading: isLoading,
  plugins: visiblePlugins,
  selectedCount: computed(() => selectedPlugins.value.length),
  selectedPluginIds,
  batchDisable: batchDisableSelected,
  batchInstall: batchInstallSelected,
  batchUninstall: batchUninstallSelected,
  install: installPlugin,
  remove: removePlugin,
  select: setPluginSelected,
  startDrag: startPluginPointerDrag,
  startRowDrag: startPluginRowPointerDrag,
  toggle: togglePlugin,
  toggleAll: toggleAllVisiblePlugins,
  update: updatePlugin,
});

const {
  addSubscription,
  isAddingSubscription,
  isSyncingSubscription,
  loadSubscriptions,
  removeSubscription,
  subscriptions,
  subscriptionUrl,
  syncSubscription,
} = usePluginSubscriptions({
  catalogPlugins,
  loadDeletedPluginIds,
  mergeCatalogPlugins,
  notify: notifyPlugin,
  officialCatalogPlugins,
  pruneSelection,
  visiblePlugins,
});

const { pluginSubscriptionsPanelListeners, pluginSubscriptionsPanelProps } = usePluginSubscriptionsPanelBindings({
  adding: isAddingSubscription,
  isSyncingSubscription,
  modelValue: subscriptionUrl,
  subscriptions,
  add: addSubscription,
  importLocalFile: importFromLocalFile,
  remove: removeSubscription,
  sync: syncSubscription,
});

usePluginManagerLifecycle({
  loadCachedCatalogPlugins,
  loadDeletedPluginIds,
  loadInstalledPlugins,
  loadSubscriptions,
  refreshOfficialCatalogInBackground,
  resetPluginPointerDragState,
  startPluginCatalogFocusRefresh,
  stopPluginCatalogFocusRefresh,
});
</script>

<template>
  <section class="plugin-manager-view">
    <PluginManagerHeader title="插件中心" subtitle="浏览插件市场，管理本地插件和订阅源。" />

    <PluginCenterTabs label="插件中心" :items="pluginCenterTabs" :model-value="activePluginCenterTab" @select="selectPluginCenterTab" />

    <PluginMarketPanel
      v-if="activePluginCenterTab === 'market'"
      v-bind="{ ...pluginMarketPanelProps, ...pluginMarketPanelListeners }"
    />

    <PluginInstalledPanel
      v-else-if="activePluginCenterTab === 'installed'"
      v-bind="{ ...pluginInstalledPanelProps, ...pluginInstalledPanelListeners }"
    />

    <PluginSubscriptionsPanel
      v-else
      v-bind="{ ...pluginSubscriptionsPanelProps, ...pluginSubscriptionsPanelListeners }"
    />

    <PluginLoadingOverlay v-if="isAddingSubscription" />
  </section>
</template>

<style scoped>
.plugin-manager-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 22px 28px 28px;
  background: var(--smw-bg-workspace);
}

@media (max-width: 860px) {
  .plugin-manager-view {
    overflow: auto;
    padding: 18px;
  }

}
</style>

