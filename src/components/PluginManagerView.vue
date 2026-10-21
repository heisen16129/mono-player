<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { usePluginNavigation } from '../composables/usePluginNavigation';
import { usePluginCatalogState } from '../composables/usePluginCatalogState';
import { usePluginCenterTabs } from '../composables/usePluginCenterTabs';
import { usePluginDragSort } from '../composables/usePluginDragSort';
import { usePluginInstallActions } from '../composables/usePluginInstallActions';
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
import PluginPackagePanel from './plugin-manager/PluginPackagePanel.vue';
import PluginInstalledPanel from './plugin-manager/PluginInstalledPanel.vue';
import PluginCenterTabs from './plugin-manager/PluginCenterTabs.vue';
import PluginLoadingOverlay from './plugin-manager/PluginLoadingOverlay.vue';
import PluginManagerHeader from './plugin-manager/PluginManagerHeader.vue';
import PluginMarketPanel from './plugin-manager/PluginMarketPanel.vue';
import PluginSubscriptionsPanel from './plugin-manager/PluginSubscriptionsPanel.vue';

import { PACKAGE_INSTALL_EVENT, type PackageInstallRequest } from '../services/pluginPackages';
async function reviewRequestedPackage(event: Event) {
  const request = (event as CustomEvent<PackageInstallRequest>).detail;
  await nextTick();
  if (!packagePanel.value) { request.reject(new Error('插件管理不可用')); return; }
  try { await packagePanel.value.reviewPackage(request.path, request); }
  catch (error) { emit('notify', String(error), 'error'); }
}
onMounted(() => window.addEventListener(PACKAGE_INSTALL_EVENT, reviewRequestedPackage));
onBeforeUnmount(() => window.removeEventListener(PACKAGE_INSTALL_EVENT, reviewRequestedPackage));

const player = usePlayerStore();
const packagePanel = ref<InstanceType<typeof PluginPackagePanel> | null>(null);
async function importFromLocalFile() {
  await packagePanel.value?.importPackage();
}
const appLocale = computed(() => resolveLocale(player.settings.locale));

const emit = defineEmits<{
  notify: [message: string, variant?: 'success' | 'error'];
}>();

const {
  notifyPlugin,
  createFormatCapabilities,
} = usePluginManagerPresentation({
  notify: (message, variant) => emit('notify', message, variant),
});

const {
  activePluginCenterTab,
  pluginCenterTabs,
  selectPluginCenterTab,
} = usePluginCenterTabs();
const { settingsPluginId } = usePluginNavigation();
watch(settingsPluginId, async id => {
  if (!id) return;
  selectPluginCenterTab('installed');
  await nextTick();
  await packagePanel.value?.openSettings(id);
  settingsPluginId.value = null;
}, { immediate:true });

const {
  catalogPlugins,
  deletedPluginIds,
  installedPlugins,
  isLoadingOfficialCatalog,
  officialCatalogPlugins,
  loadCachedCatalogPlugins,
  loadDeletedPluginIds,
  loadInstalledPlugins,
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
  selectedPluginIds,
  setPluginSelected,
  toggleAllVisiblePlugins,
  pruneSelection,
  selectedEnabledPlugins,
  selectedInstallablePlugins,
  selectedPlugins,
} = usePluginSelection(visiblePlugins);
registerPluginCatalogSelectionPruner(pruneSelection);

const {
  installPlugin,
  updatePlugin,
  removePlugin,
  togglePlugin,
  isBatchBusy,
  batchInstallSelected,
  batchUninstallSelected,
  batchDisableSelected,
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
  resetPluginPointerDragState,
  draggingPluginId,
  dragOverPluginId,
  startPluginPointerDrag,
  startPluginRowPointerDrag,
} = usePluginDragSort({
  installedPlugins,
  notify: notifyPlugin,
  visiblePlugins,
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
      :all-visible-selected="allVisibleSelected"
      :busy="isBatchBusy"
      :drag-over-plugin-id="dragOverPluginId"
      :dragging-plugin-id="draggingPluginId"
      :enabled-count="selectedEnabledPlugins.length"
      :format-capabilities="formatCapabilities"
      :installable-count="selectedInstallablePlugins.length"
      :loading="false"
      :plugins="visiblePlugins"
      :selected-count="selectedPlugins.length"
      :selected-plugin-ids="selectedPluginIds"
      @batch-disable="batchDisableSelected"
      @batch-install="batchInstallSelected"
      @batch-uninstall="batchUninstallSelected"
      @install="installPlugin"
      @remove="removePlugin"
      @select="setPluginSelected"
      @start-drag="startPluginPointerDrag"
      @start-row-drag="startPluginRowPointerDrag"
      @toggle="togglePlugin"
      @toggle-all="toggleAllVisiblePlugins"
      @update="updatePlugin"
    />

    <PluginSubscriptionsPanel
      v-else
      v-bind="{ ...pluginSubscriptionsPanelProps, ...pluginSubscriptionsPanelListeners }"
    />

    <PluginPackagePanel
      ref="packagePanel"
      @installed="loadInstalledPlugins(); loadDeletedPluginIds()"
      @notify="(message, variant) => emit('notify', message, variant)"
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

