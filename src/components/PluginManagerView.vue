<script setup lang="ts">
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderInput,
  Info,
  ListMusic,
  Mic,
  Music,
  Palette,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  Wifi,
  Wrench,
} from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import PageHeader from './PageHeader.vue';
import SegmentTabs from './SegmentTabs.vue';
import {
  addPluginSubscription,
  fetchAllPluginCatalogs,
  fetchPluginCatalog,
  installCatalogPlugin,
  installLocalPlugin,
  listCachedPluginCatalog,
  listDeletedPluginIds,
  listInstalledPlugins,
  listPluginSubscriptions,
  readPluginTheme,
  restoreDeletedPluginsFromCatalog,
  saveCachedPluginCatalog,
  saveInstalledPlugins,
  savePluginSubscriptions,
  setPluginEnabled,
  uninstallPlugin,
} from '../services/plugins';
import type { PluginCapability, PluginCatalogItem, PluginManifest, PluginSubscription } from '../types/plugin';
import { resolveLocale } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { CustomTheme } from '../types/music';
import { getErrorMessage } from '../utils/error';
import PluginBulkActions from './plugin-manager/PluginBulkActions.vue';
import PluginLoadingOverlay from './plugin-manager/PluginLoadingOverlay.vue';
import PluginSubscriptionForm from './plugin-manager/PluginSubscriptionForm.vue';
import PluginTable from './plugin-manager/PluginTable.vue';
import type { PluginRow } from './plugin-manager/types';

type PluginCenterTab = 'market' | 'installed' | 'subscriptions';
type PluginMarketCategory = 'all' | 'music' | 'lyrics' | 'metadata' | 'playlist' | 'theme' | 'integration' | 'tool';
type PluginMarketKind = Exclude<PluginMarketCategory, 'all'>;
type PluginMarketStatus = 'available' | 'installed' | 'update';

interface PluginMarketItem {
  id: string;
  name: string;
  author: string;
  version: string;
  installedVersion?: string;
  icon?: string;
  kind: PluginMarketKind;
  runtime: string;
  capabilities: string[];
  permissions: string[];
  description: string;
  source: string;
  minAppVersion?: string;
  updatedAt: string;
  status: PluginMarketStatus;
  tags: string[];
  highlights: string[];
  screenshots?: string[];
  catalogItem: PluginCatalogItem | null;
  manifest: PluginManifest | null;
}

const OFFICIAL_PLUGIN_CATALOG_SUBSCRIPTION: PluginSubscription = {
  id: 'official-plugin-store',
  name: '官方插件商城',
  url: 'https://raw.githubusercontent.com/heisen16129/mono-plugin-store/refs/heads/master/catalog.json',
};
const OFFICIAL_PLUGIN_ENTRY_PREFIX = 'https://raw.githubusercontent.com/heisen16129/mono-plugin-store/';

const installedPlugins = ref<PluginManifest[]>([]);
const catalogPlugins = ref<PluginCatalogItem[]>([]);
const officialCatalogPlugins = ref<PluginCatalogItem[]>([]);
const subscriptions = ref<PluginSubscription[]>([]);
const subscriptionUrl = ref('');
const isLoading = ref(false);
const isLoadingOfficialCatalog = ref(false);
const isAddingSubscription = ref(false);
const isBatchBusy = ref(false);
const selectedPluginIds = ref<Set<string>>(new Set());
const deletedPluginIds = ref<Set<string>>(new Set());
const draggingPluginId = ref<string | null>(null);
const dragOverPluginId = ref<string | null>(null);
const hasPendingPluginOrderChange = ref(false);
const activePluginCenterTab = ref<PluginCenterTab>('market');
const activeMarketCategory = ref<PluginMarketCategory>('all');
const marketSearch = ref('');
const activeMarketStatus = ref<'all' | PluginMarketStatus>('all');
const installingPluginIds = ref<Set<string>>(new Set());
const syncingSubscriptionIds = ref<Set<string>>(new Set());
const player = usePlayerStore();
const appLocale = computed(() => resolveLocale(player.settings.locale));

const emit = defineEmits<{
  notify: [message: string, variant?: 'success' | 'error'];
}>();

const pluginCenterTabs = [
  { id: 'market', label: '商城' },
  { id: 'installed', label: '已安装' },
  { id: 'subscriptions', label: '订阅源' },
];

const marketStatusFilters = [
  { id: 'all', label: '全部' },
  { id: 'available', label: '可安装' },
  { id: 'installed', label: '已安装' },
  { id: 'update', label: '可更新' },
] satisfies Array<{ id: 'all' | PluginMarketStatus; label: string }>;

const marketCategories = [
  { id: 'all', label: '全部', description: '显示全部插件' },
  { id: 'music', label: '音源', description: '搜索和播放在线音乐' },
  { id: 'lyrics', label: '歌词', description: '搜索、匹配和处理歌词' },
  { id: 'metadata', label: '元数据', description: '补全封面、专辑和曲目信息' },
  { id: 'playlist', label: '歌单', description: '导入和导出歌单' },
  { id: 'theme', label: '主题', description: '安装播放器主题资源包' },
  { id: 'integration', label: '集成', description: '连接外部服务' },
  { id: 'tool', label: '工具', description: '批处理和辅助工具' },
] satisfies Array<{ id: PluginMarketCategory; label: string; description: string }>;

const selectedMarketPluginId = ref('');

function isMarketPluginKind(kind: string): kind is PluginMarketKind {
  return marketCategories.some((category) => category.id === kind && category.id !== 'all');
}

function isOfficialPluginSource(source: string | null | undefined) {
  return Boolean(source?.startsWith(OFFICIAL_PLUGIN_ENTRY_PREFIX));
}

function isRemotePluginSource(source: string | null | undefined) {
  return Boolean(source && /^https?:\/\//i.test(source));
}

function pluginSourceLabel(catalogItem: PluginCatalogItem | null, manifest: PluginManifest | null) {
  const sourceKind = catalogItem?.sourceKind ?? manifest?.sourceKind;
  if (sourceKind === 'official') return '官方';
  if (sourceKind === 'subscription') return '订阅';
  if (sourceKind === 'local') return '本地';

  const source = catalogItem?.sourceUrl ?? manifest?.sourceUrl ?? manifest?.entry ?? '';
  if (isOfficialPluginSource(source)) return '官方';
  if (catalogItem || isRemotePluginSource(source)) return '订阅';
  return '本地';
}

function pluginStatus(catalogItem: PluginCatalogItem | null, manifest: PluginManifest | null): PluginMarketStatus {
  if (!manifest) return 'available';
  if (catalogItem && catalogItem.version !== manifest.version) return 'update';
  return 'installed';
}

function capabilityTag(capability: string) {
  const labels: Record<string, string> = {
    search: '搜索歌曲',
    play: '在线播放',
    lyrics: '歌词获取',
  };
  return labels[capability] ?? capability;
}

function localizedCapability(capability: string) {
  if (appLocale.value !== 'zh-CN') return capability;
  const labels: Record<string, string> = {
    search: '搜索歌曲',
    play: '在线播放',
    lyrics: '歌词获取',
    metadata: '元数据',
    cover: '封面',
    album: '专辑',
    'playlist-import': '导入歌单',
    'playlist-export': '导出歌单',
    theme: '主题',
    scrobble: '播放记录同步',
    'history-sync': '历史同步',
    'batch-rename': '批量重命名',
    'lyric-convert': '歌词转换',
    'lyric-translate': '歌词翻译',
  };
  return labels[capability] ?? capability;
}

function localizedPermission(permission: string) {
  if (appLocale.value !== 'zh-CN') return permission;
  const labels: Record<string, string> = {
    network: '网络',
    'credential-read': '读取凭据',
    'cache-read': '读取缓存',
    'cache-write': '写入缓存',
    'download-write': '写入下载目录',
  };
  return labels[permission] ?? permission;
}

function toRealMarketPlugin(catalogItem: PluginCatalogItem | null, manifest: PluginManifest | null): PluginMarketItem | null {
  const source = catalogItem ?? manifest;
  if (!source) return null;

  return {
    id: source.id,
    name: source.name,
    author: source.author,
    version: catalogItem?.version ?? source.version,
    installedVersion: manifest?.version,
    icon: catalogItem?.icon ?? manifest?.icon,
    kind: source.kind,
    runtime: source.runtime.toUpperCase(),
    capabilities: catalogItem?.capabilities ?? manifest?.capabilities ?? [],
    permissions: catalogItem?.permissions ?? manifest?.permissions ?? [],
    description: catalogItem?.description ?? manifest?.description ?? '',
    source: pluginSourceLabel(catalogItem, manifest),
    updatedAt: catalogItem?.updatedAt ?? manifest?.updatedAt ?? '',
    status: pluginStatus(catalogItem, manifest),
    tags: catalogItem?.tags?.length ? catalogItem.tags : (manifest?.tags?.length ? manifest.tags : (source.capabilities ?? []).map(capabilityTag)),
    highlights: catalogItem?.highlights ?? manifest?.highlights ?? [],
    screenshots: catalogItem?.screenshots ?? manifest?.screenshots,
    catalogItem,
    manifest,
  };
}

const realMarketPlugins = computed(() => {
  const catalogById = new Map(officialCatalogPlugins.value.map((plugin) => [plugin.id, plugin]));
  const installedById = new Map(installedPlugins.value.map((plugin) => [plugin.id, plugin]));

  return [...catalogById.keys()]
    .map((pluginId) => toRealMarketPlugin(catalogById.get(pluginId) ?? null, installedById.get(pluginId) ?? null))
    .filter((plugin): plugin is PluginMarketItem => plugin !== null && isMarketPluginKind(plugin.kind))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
});

const marketPlugins = computed<PluginMarketItem[]>(() => realMarketPlugins.value);

const filteredMarketPlugins = computed(() => {
  const keyword = marketSearch.value.trim().toLowerCase();
  return marketPlugins.value.filter((plugin) => {
    const matchesCategory = activeMarketCategory.value === 'all' || plugin.kind === activeMarketCategory.value;
    const matchesStatus = activeMarketStatus.value === 'all' || plugin.status === activeMarketStatus.value;
    const matchesKeyword = !keyword || [
      plugin.name,
      plugin.author,
      plugin.description,
      plugin.kind,
      plugin.runtime,
      ...plugin.capabilities,
      ...plugin.capabilities.map(localizedCapability),
      ...plugin.tags,
    ].some((value) => value.toLowerCase().includes(keyword));

    return matchesCategory && matchesStatus && matchesKeyword;
  });
});

const selectedMarketPlugin = computed(() => {
  const selected = filteredMarketPlugins.value.find((plugin) => plugin.id === selectedMarketPluginId.value);
  return selected ?? filteredMarketPlugins.value[0] ?? null;
});

const activeScreenshotIndex = ref(0);
const selectedPluginScreenshots = computed(() => selectedMarketPlugin.value?.screenshots?.slice(0, 5) ?? []);
const activePluginScreenshot = computed(() => selectedPluginScreenshots.value[activeScreenshotIndex.value] ?? '');

watch(selectedMarketPluginId, () => {
  activeScreenshotIndex.value = 0;
});

function notifyPlugin(message: string) {
  if (!message) return;
  const variant = /失败|错误|不可|请先/.test(message) ? 'error' : 'success';
  emit('notify', message, variant);
}

function selectScreenshot(index: number) {
  if (index < 0 || index >= selectedPluginScreenshots.value.length) return;
  activeScreenshotIndex.value = index;
}

function showPreviousScreenshot() {
  const total = selectedPluginScreenshots.value.length;
  if (total <= 1) return;
  activeScreenshotIndex.value = (activeScreenshotIndex.value + total - 1) % total;
}

function showNextScreenshot() {
  const total = selectedPluginScreenshots.value.length;
  if (total <= 1) return;
  activeScreenshotIndex.value = (activeScreenshotIndex.value + 1) % total;
}

function selectPluginCenterTab(tab: string | null) {
  if (tab === 'market' || tab === 'installed' || tab === 'subscriptions') {
    activePluginCenterTab.value = tab;
  }
}

function selectMarketCategory(category: PluginMarketCategory) {
  activeMarketCategory.value = category;
  const nextPlugin = filteredMarketPlugins.value[0];
  selectedMarketPluginId.value = nextPlugin?.id ?? '';
}

function selectMarketPlugin(plugin: PluginMarketItem) {
  selectedMarketPluginId.value = plugin.id;
}

function pluginKindLabel(kind: PluginMarketCategory) {
  return marketCategories.find((category) => category.id === kind)?.label ?? kind;
}

function pluginStatusLabel(status: PluginMarketStatus) {
  if (status === 'installed') return '已安装';
  if (status === 'update') return '可更新';
  return '可安装';
}

function pluginActionLabel(plugin: PluginMarketItem) {
  if (installingPluginIds.value.has(plugin.id)) return plugin.status === 'update' ? '更新中' : '安装中';
  if (plugin.status === 'installed') return '已安装';
  if (plugin.status === 'update') return '更新';
  return '安装';
}

function isInstallingPlugin(pluginId: string) {
  return installingPluginIds.value.has(pluginId);
}

function setInstallingPlugin(pluginId: string, installing: boolean) {
  const nextPluginIds = new Set(installingPluginIds.value);
  if (installing) {
    nextPluginIds.add(pluginId);
  } else {
    nextPluginIds.delete(pluginId);
  }
  installingPluginIds.value = nextPluginIds;
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

function handleMarketPluginAction(plugin: PluginMarketItem) {
  if (plugin.status === 'installed') return;
  if (isInstallingPlugin(plugin.id)) return;
  if (!plugin.catalogItem) {
    notifyPlugin('该插件暂未接入安装包');
    return;
  }

  const actionLabel = plugin.status === 'update' ? '更新' : '安装';
  const action = plugin.status === 'update' ? updatePlugin : installPlugin;
  setInstallingPlugin(plugin.id, true);
  notifyPlugin(`正在后台${actionLabel} ${plugin.name}`);
  void action(plugin.catalogItem)
    .catch((error) => {
      notifyPlugin(`${actionLabel}失败：${getErrorMessage(error, '插件安装失败')}`);
    })
    .finally(() => setInstallingPlugin(plugin.id, false));
}

const visiblePlugins = computed<PluginRow[]>(() => {
  const catalogById = new Map(catalogPlugins.value.map((plugin) => [plugin.id, plugin]));
  const installedRows = installedPlugins.value.map((plugin) => {
    const catalogItem = catalogById.get(plugin.id) ?? null;

    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      latestVersion: catalogItem?.version ?? plugin.version,
      author: plugin.author ?? '',
      runtime: plugin.runtime,
      capabilities: plugin.capabilities,
      installed: true,
      enabled: plugin.enabled,
      catalogItem,
      manifest: plugin,
    };
  });
  const installedIds = new Set(installedRows.map((item) => item.id));
  const catalogRows = catalogPlugins.value
    .filter((item) => !installedIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      version: item.version,
      latestVersion: item.version,
      author: item.author ?? '',
      runtime: item.runtime,
      capabilities: [],
      installed: false,
      enabled: false,
      catalogItem: item,
      manifest: null,
    }));

  return [...installedRows, ...catalogRows].filter((plugin) => !deletedPluginIds.value.has(plugin.id));
});

const selectedPlugins = computed(() => {
  return visiblePlugins.value.filter((plugin) => selectedPluginIds.value.has(plugin.id));
});

const selectedInstallablePlugins = computed(() => {
  return selectedPlugins.value.filter((plugin) => plugin.catalogItem && !plugin.installed);
});

const selectedEnabledPlugins = computed(() => {
  return selectedPlugins.value.filter((plugin) => plugin.manifest && plugin.enabled);
});

const allVisibleSelected = computed(() => {
  return visiblePlugins.value.length > 0 && visiblePlugins.value.every((plugin) => selectedPluginIds.value.has(plugin.id));
});

function mergeCatalogPlugins(currentPlugins: PluginCatalogItem[], nextPlugins: PluginCatalogItem[]) {
  const pluginById = new Map(currentPlugins.map((plugin) => [plugin.id, plugin]));
  for (const plugin of nextPlugins) {
    pluginById.set(plugin.id, plugin);
  }
  return [...pluginById.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

async function loadOfficialCatalog() {
  const plugins = await fetchPluginCatalog(OFFICIAL_PLUGIN_CATALOG_SUBSCRIPTION);
  officialCatalogPlugins.value = plugins;
  catalogPlugins.value = mergeCatalogPlugins(catalogPlugins.value, plugins);
  await saveCachedPluginCatalog(catalogPlugins.value);
  return plugins;
}

function formatCapabilities(capabilities: PluginCapability[], installed = true) {
  if (!installed) return '';
  return capabilities.length > 0 ? capabilities.map(localizedCapability).join(' / ') : '无可用能力';
}

function pruneSelection() {
  const visibleIds = new Set(visiblePlugins.value.map((plugin) => plugin.id));
  selectedPluginIds.value = new Set([...selectedPluginIds.value].filter((id) => visibleIds.has(id)));
}

function setPluginSelected(pluginId: string, selected: boolean) {
  const nextSelected = new Set(selectedPluginIds.value);
  if (selected) {
    nextSelected.add(pluginId);
  } else {
    nextSelected.delete(pluginId);
  }
  selectedPluginIds.value = nextSelected;
}

function toggleAllVisiblePlugins() {
  if (allVisibleSelected.value) {
    selectedPluginIds.value = new Set();
    return;
  }

  selectedPluginIds.value = new Set(visiblePlugins.value.map((plugin) => plugin.id));
}

function startPluginPointerDrag(event: PointerEvent, plugin: PluginRow) {
  if (!plugin.installed || !plugin.manifest) return;

  event.preventDefault();
  event.stopPropagation();
  draggingPluginId.value = plugin.id;
  dragOverPluginId.value = plugin.id;
  hasPendingPluginOrderChange.value = false;
  window.addEventListener('pointermove', handlePluginPointerMove);
  window.addEventListener('pointerup', finishPluginPointerDrag, { once: true });
  window.addEventListener('pointercancel', cancelPluginPointerDrag, { once: true });
}

function startPluginRowPointerDrag(event: PointerEvent, plugin: PluginRow) {
  if (!plugin.installed || !plugin.manifest) return;
  if (event.button !== 0) return;

  const target = event.target;
  if (
    target instanceof HTMLElement
    && target.closest('button, input, a, select, textarea, .row-actions')
  ) {
    return;
  }

  startPluginPointerDrag(event, plugin);
}

function handlePluginPointerMove(event: PointerEvent) {
  if (!draggingPluginId.value) return;

  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLTableRowElement>('[data-plugin-id]');
  const pluginId = row?.dataset.pluginId;
  if (!pluginId) return;

  const plugin = visiblePlugins.value.find((item) => item.id === pluginId);
  if (plugin) moveDraggedPluginTo(plugin);
}

function moveDraggedPluginTo(plugin: PluginRow) {
  const sourceId = draggingPluginId.value;
  if (!sourceId || !plugin.installed || sourceId === plugin.id) return;

  const sourceIndex = installedPlugins.value.findIndex((item) => item.id === sourceId);
  const targetIndex = installedPlugins.value.findIndex((item) => item.id === plugin.id);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const nextInstalledPlugins = [...installedPlugins.value];
  const [movedPlugin] = nextInstalledPlugins.splice(sourceIndex, 1);
  nextInstalledPlugins.splice(targetIndex, 0, movedPlugin);
  installedPlugins.value = nextInstalledPlugins;
  dragOverPluginId.value = plugin.id;
  hasPendingPluginOrderChange.value = true;
}

async function finishPluginPointerDrag() {
  if (hasPendingPluginOrderChange.value) {
    await saveInstalledPlugins(installedPlugins.value);
    notifyPlugin('插件排序已保存');
  }

  resetPluginPointerDragState();
}

function cancelPluginPointerDrag() {
  resetPluginPointerDragState();
}

function resetPluginPointerDragState() {
  window.removeEventListener('pointermove', handlePluginPointerMove);
  window.removeEventListener('pointerup', finishPluginPointerDrag);
  window.removeEventListener('pointercancel', cancelPluginPointerDrag);
  draggingPluginId.value = null;
  dragOverPluginId.value = null;
  hasPendingPluginOrderChange.value = false;
}

async function loadInstalledPlugins() {
  installedPlugins.value = await listInstalledPlugins();
  pruneSelection();
}

async function loadDeletedPluginIds() {
  deletedPluginIds.value = new Set(await listDeletedPluginIds());
  pruneSelection();
}

function pluginThemeId(themeId: string | undefined, fallbackId: string): CustomTheme['id'] {
  const id = themeId?.trim() || fallbackId;
  return (id.startsWith('custom:') ? id : `custom:${id}`) as CustomTheme['id'];
}

async function addThemeFromPlugin(manifest: PluginManifest): Promise<boolean> {
  if (manifest.kind !== 'theme' || !manifest.capabilities.includes('theme')) return false;

  const theme = await readPluginTheme(manifest);
  player.addCustomTheme({
    id: pluginThemeId(theme.id, manifest.id),
    name: theme.name?.trim() || manifest.name,
    author: theme.author?.trim() || manifest.author,
    variables: theme.variables,
    preview: theme.preview ?? manifest.icon ?? null,
    background: theme.background ?? null,
    backgroundOpacity: theme.backgroundOpacity ?? null,
  }, false);
  return true;
}

async function removeThemeFromPlugin(manifest: PluginManifest) {
  if (manifest.kind !== 'theme' || !manifest.capabilities.includes('theme')) return;

  try {
    const theme = await readPluginTheme(manifest);
    player.removeCustomTheme(pluginThemeId(theme.id, manifest.id));
  } catch {
    player.removeCustomTheme(pluginThemeId(undefined, manifest.id));
  }
}

async function installPlugin(item: PluginCatalogItem) {
  installedPlugins.value = await installCatalogPlugin(item);
  const manifest = installedPlugins.value.find((plugin) => plugin.id === item.id);
  let themeInstalled = false;
  if (manifest) {
    try {
      themeInstalled = await addThemeFromPlugin(manifest);
    } catch (error) {
      notifyPlugin(`已安装 ${item.name}，主题读取失败：${getErrorMessage(error, '读取失败')}`);
      await loadDeletedPluginIds();
      return;
    }
  }
  await loadDeletedPluginIds();
  notifyPlugin(themeInstalled ? `已安装 ${item.name}，主题已加入本地主题` : `已安装 ${item.name}`);
}

async function updatePlugin(item: PluginCatalogItem) {
  installedPlugins.value = await installCatalogPlugin(item);
  const manifest = installedPlugins.value.find((plugin) => plugin.id === item.id);
  let themeUpdated = false;
  if (manifest) {
    try {
      themeUpdated = await addThemeFromPlugin(manifest);
    } catch (error) {
      notifyPlugin(`已更新 ${item.name}，主题读取失败：${getErrorMessage(error, '读取失败')}`);
      await loadDeletedPluginIds();
      return;
    }
  }
  await loadDeletedPluginIds();
  notifyPlugin(themeUpdated ? `已更新 ${item.name}，主题已同步` : `已更新 ${item.name}`);
}

async function removePlugin(pluginId: string, pluginName: string) {
  const manifest = installedPlugins.value.find((plugin) => plugin.id === pluginId);
  installedPlugins.value = await uninstallPlugin(pluginId);
  if (manifest) await removeThemeFromPlugin(manifest);
  catalogPlugins.value = catalogPlugins.value.filter((plugin) => plugin.id !== pluginId);
  await loadDeletedPluginIds();
  notifyPlugin(`已卸载 ${pluginName}`);
  pruneSelection();
}

async function togglePlugin(plugin: PluginManifest) {
  installedPlugins.value = await setPluginEnabled(plugin.id, !plugin.enabled);
}

async function batchInstallSelected() {
  if (selectedInstallablePlugins.value.length === 0) return;
  const pluginsToInstall = selectedInstallablePlugins.value;
  isBatchBusy.value = true;

  try {
    for (const plugin of pluginsToInstall) {
      if (plugin.catalogItem) {
        installedPlugins.value = await installCatalogPlugin(plugin.catalogItem);
        const manifest = installedPlugins.value.find((item) => item.id === plugin.catalogItem?.id);
        if (manifest) await addThemeFromPlugin(manifest);
      }
    }
    await loadDeletedPluginIds();
    notifyPlugin(`已安装 ${pluginsToInstall.length} 个插件`);
  } finally {
    isBatchBusy.value = false;
    pruneSelection();
  }
}

async function batchUninstallSelected() {
  if (selectedPlugins.value.length === 0) return;
  const pluginsToUninstall = selectedPlugins.value;
  isBatchBusy.value = true;

  try {
    for (const plugin of pluginsToUninstall) {
      if (plugin.manifest) await removeThemeFromPlugin(plugin.manifest);
      installedPlugins.value = await uninstallPlugin(plugin.id);
      catalogPlugins.value = catalogPlugins.value.filter((item) => item.id !== plugin.id);
    }
    await loadDeletedPluginIds();
    notifyPlugin(`已卸载 ${pluginsToUninstall.length} 个插件`);
  } finally {
    isBatchBusy.value = false;
    pruneSelection();
  }
}

async function batchDisableSelected() {
  if (selectedEnabledPlugins.value.length === 0) return;
  const pluginsToDisable = selectedEnabledPlugins.value;
  isBatchBusy.value = true;

  try {
    for (const plugin of pluginsToDisable) {
      if (plugin.manifest) installedPlugins.value = await setPluginEnabled(plugin.manifest.id, false);
    }
    notifyPlugin(`已停用 ${pluginsToDisable.length} 个插件`);
  } finally {
    isBatchBusy.value = false;
    pruneSelection();
  }
}

async function importFromLocalFile() {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'WASM Plugin', extensions: ['wasm'] },
    ],
  });

  if (typeof selected !== 'string') return;
  installedPlugins.value = await installLocalPlugin(selected);
  const manifest = installedPlugins.value[0];
  let themeInstalled = false;
  if (manifest) {
    try {
      themeInstalled = await addThemeFromPlugin(manifest);
    } catch (error) {
      notifyPlugin(`已导入本地插件，主题读取失败：${getErrorMessage(error, '读取失败')}`);
      await loadDeletedPluginIds();
      return;
    }
  }
  await loadDeletedPluginIds();
  notifyPlugin(themeInstalled ? '已导入本地主题插件，主题已加入本地主题' : '已导入本地插件');
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
    notifyPlugin(`已添加 ${addedPlugins.length} 个插件，当前共 ${visibleCount} 个可显示插件`);
  } catch (error) {
    notifyPlugin(`订阅失败：${getErrorMessage(error, '订阅失败')}`);
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
    notifyPlugin(`已删除订阅 ${subscription.name}`);
  } catch (error) {
    catalogPlugins.value = officialCatalogPlugins.value;
    await saveCachedPluginCatalog(catalogPlugins.value);
    notifyPlugin(`已删除订阅 ${subscription.name}，剩余订阅刷新失败：${getErrorMessage(error, '刷新失败')}`);
  } finally {
    pruneSelection();
  }
}

async function syncSubscription(subscription: PluginSubscription) {
  if (isSyncingSubscription(subscription.id)) return;
  setSyncingSubscription(subscription.id, true);
  notifyPlugin(`正在同步订阅 ${subscription.name}`);

  try {
    const syncedPlugins = await fetchPluginCatalog(subscription);
    catalogPlugins.value = mergeCatalogPlugins(catalogPlugins.value, syncedPlugins);
    await saveCachedPluginCatalog(catalogPlugins.value);
    await restoreDeletedPluginsFromCatalog(syncedPlugins);
    await loadDeletedPluginIds();
    notifyPlugin(`已同步订阅 ${subscription.name}，更新 ${syncedPlugins.length} 个插件`);
  } catch (error) {
    notifyPlugin(`同步订阅失败：${getErrorMessage(error, '同步失败')}`);
  } finally {
    setSyncingSubscription(subscription.id, false);
    pruneSelection();
  }
}

async function refreshOfficialCatalogInBackground() {
  isLoadingOfficialCatalog.value = true;
  try {
    await loadOfficialCatalog();
  } catch (error) {
    officialCatalogPlugins.value = [];
    console.warn('[PluginMarket] official catalog fetch failed', error);
  } finally {
    isLoadingOfficialCatalog.value = false;
    pruneSelection();
  }
}

function refreshInstalledPluginsOnFocus() {
  void Promise.all([loadInstalledPlugins(), loadDeletedPluginIds()]).catch((error) => {
    console.warn('[PluginManager] installed plugin refresh failed', error);
  });
}

onMounted(async () => {
  await loadInstalledPlugins();
  await loadDeletedPluginIds();
  subscriptions.value = await listPluginSubscriptions();
  const cachedCatalogPlugins = await listCachedPluginCatalog();
  catalogPlugins.value = cachedCatalogPlugins;
  pruneSelection();
  void refreshOfficialCatalogInBackground();
  window.addEventListener('focus', refreshInstalledPluginsOnFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshInstalledPluginsOnFocus);
  resetPluginPointerDragState();
});
</script>

<template>
  <section class="plugin-manager-view">
    <PageHeader class="plugin-header" title="插件中心" subtitle="浏览插件市场，管理本地插件和订阅源。" />

    <SegmentTabs label="插件中心" :items="pluginCenterTabs" :model-value="activePluginCenterTab" root-class="plugin-center-tabs" @select="selectPluginCenterTab" />

    <div v-if="activePluginCenterTab === 'market'" class="plugin-market-shell">
      <aside class="plugin-market-sidebar" aria-label="插件分类">
        <button
          v-for="category in marketCategories"
          :key="category.id"
          type="button"
          :class="['plugin-category-button', { active: activeMarketCategory === category.id }]"
          @click="selectMarketCategory(category.id)"
        >
          <Music v-if="category.id === 'music'" :size="16" />
          <Mic v-else-if="category.id === 'lyrics'" :size="16" />
          <Tags v-else-if="category.id === 'metadata'" :size="16" />
          <ListMusic v-else-if="category.id === 'playlist'" :size="16" />
          <Palette v-else-if="category.id === 'theme'" :size="16" />
          <Plug v-else-if="category.id === 'integration'" :size="16" />
          <Wrench v-else-if="category.id === 'tool'" :size="16" />
          <CheckCircle2 v-else :size="16" />
          <span>
            <strong>{{ category.label }}</strong>
            <small>{{ category.description }}</small>
          </span>
        </button>
      </aside>

      <main class="plugin-market-main">
        <div class="plugin-market-toolbar">
          <label class="plugin-market-search">
            <Search :size="16" />
            <input v-model="marketSearch" type="search" placeholder="搜索插件、作者、能力" />
          </label>
        </div>

        <div class="plugin-market-filters" aria-label="安装状态筛选">
          <button
            v-for="filter in marketStatusFilters"
            :key="filter.id"
            type="button"
            :class="{ active: activeMarketStatus === filter.id }"
            @click="activeMarketStatus = filter.id"
          >
            {{ filter.label }}
          </button>
        </div>

        <div class="plugin-market-list" aria-label="插件列表">
          <div v-if="isLoadingOfficialCatalog" class="plugin-market-empty">
            <RefreshCw class="spinning" :size="18" />
            <span>正在加载官方插件</span>
          </div>

          <template v-else>
            <div
              v-for="plugin in filteredMarketPlugins"
              :key="plugin.id"
              :class="['plugin-market-card', { selected: selectedMarketPlugin?.id === plugin.id }]"
              role="button"
              tabindex="0"
              @click="selectMarketPlugin(plugin)"
              @keydown.enter.prevent="selectMarketPlugin(plugin)"
              @keydown.space.prevent="selectMarketPlugin(plugin)"
            >
              <span class="plugin-card-icon" :class="plugin.kind">
                <img v-if="plugin.icon" :src="plugin.icon" alt="" draggable="false" />
                <Music v-else-if="plugin.kind === 'music'" :size="20" />
                <Mic v-else-if="plugin.kind === 'lyrics'" :size="20" />
                <Tags v-else-if="plugin.kind === 'metadata'" :size="20" />
                <ListMusic v-else-if="plugin.kind === 'playlist'" :size="20" />
                <Palette v-else-if="plugin.kind === 'theme'" :size="20" />
                <Plug v-else-if="plugin.kind === 'integration'" :size="20" />
                <Wrench v-else :size="20" />
              </span>
              <span class="plugin-card-body">
                <span class="plugin-card-title-row">
                  <strong>{{ plugin.name }}</strong>
                  <span :class="['plugin-status-badge', plugin.status]">{{ pluginStatusLabel(plugin.status) }}</span>
                </span>
                <span class="plugin-card-meta">{{ plugin.author }} · v{{ plugin.version }} · {{ plugin.runtime }}</span>
                <span class="plugin-card-description">{{ plugin.description }}</span>
                <span class="plugin-card-tags">
                  <span>{{ pluginKindLabel(plugin.kind) }}</span>
                  <span v-for="tag in plugin.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
                </span>
              </span>
              <button class="plugin-card-action" :class="plugin.status" type="button" :disabled="plugin.status === 'installed' || isInstallingPlugin(plugin.id)" @click.stop="handleMarketPluginAction(plugin)">
                <RefreshCw v-if="isInstallingPlugin(plugin.id) || plugin.status === 'update'" :class="{ spinning: isInstallingPlugin(plugin.id) }" :size="14" />
                <CheckCircle2 v-else-if="plugin.status === 'installed'" :size="14" />
                <Download v-else :size="14" />
                {{ pluginActionLabel(plugin) }}
              </button>
            </div>
          </template>

          <div v-if="!isLoadingOfficialCatalog && filteredMarketPlugins.length === 0" class="plugin-market-empty">
            <Info :size="18" />
            <span>没有找到匹配的插件</span>
          </div>
        </div>
      </main>

      <aside v-if="selectedMarketPlugin" class="plugin-detail-panel" aria-label="插件详情">
        <div class="plugin-detail-heading">
          <span class="plugin-card-icon detail" :class="selectedMarketPlugin.kind">
            <img v-if="selectedMarketPlugin.icon" :src="selectedMarketPlugin.icon" alt="" draggable="false" />
            <Music v-else-if="selectedMarketPlugin.kind === 'music'" :size="24" />
            <Mic v-else-if="selectedMarketPlugin.kind === 'lyrics'" :size="24" />
            <Tags v-else-if="selectedMarketPlugin.kind === 'metadata'" :size="24" />
            <ListMusic v-else-if="selectedMarketPlugin.kind === 'playlist'" :size="24" />
            <Palette v-else-if="selectedMarketPlugin.kind === 'theme'" :size="24" />
            <Plug v-else-if="selectedMarketPlugin.kind === 'integration'" :size="24" />
            <Wrench v-else :size="24" />
          </span>
          <div>
            <h2>{{ selectedMarketPlugin.name }}</h2>
            <p>{{ selectedMarketPlugin.author }} · {{ pluginKindLabel(selectedMarketPlugin.kind) }} · {{ selectedMarketPlugin.runtime }}</p>
          </div>
        </div>

        <button class="plugin-detail-primary" type="button" :disabled="selectedMarketPlugin.status === 'installed' || isInstallingPlugin(selectedMarketPlugin.id)" @click="handleMarketPluginAction(selectedMarketPlugin)">
          <RefreshCw v-if="isInstallingPlugin(selectedMarketPlugin.id) || selectedMarketPlugin.status === 'update'" :class="{ spinning: isInstallingPlugin(selectedMarketPlugin.id) }" :size="15" />
          <CheckCircle2 v-else-if="selectedMarketPlugin.status === 'installed'" :size="15" />
          <Download v-else :size="15" />
          {{ pluginActionLabel(selectedMarketPlugin) }}
        </button>

        <section class="plugin-detail-section">
          <h3>简介</h3>
          <p>{{ selectedMarketPlugin.description }}</p>
        </section>

        <section class="plugin-detail-section">
          <h3>能力</h3>
          <div class="plugin-chip-list">
            <span v-for="capability in selectedMarketPlugin.capabilities" :key="capability">{{ localizedCapability(capability) }}</span>
          </div>
        </section>

        <section class="plugin-detail-section">
          <h3>权限</h3>
          <div v-if="selectedMarketPlugin.permissions.length > 0" class="plugin-permission-list">
            <span v-for="permission in selectedMarketPlugin.permissions" :key="permission">
              <Wifi v-if="permission === 'network'" :size="14" />
              <ShieldCheck v-else :size="14" />
              {{ localizedPermission(permission) }}
            </span>
          </div>
          <p v-else class="plugin-muted-text">无需额外权限</p>
        </section>

        <section v-if="selectedMarketPlugin.highlights.length > 0" class="plugin-detail-section">
          <h3>亮点</h3>
          <ul class="plugin-highlight-list">
            <li v-for="highlight in selectedMarketPlugin.highlights" :key="highlight">{{ highlight }}</li>
          </ul>
        </section>

        <dl class="plugin-detail-meta">
          <div><dt>版本</dt><dd>v{{ selectedMarketPlugin.version }}</dd></div>
          <div v-if="selectedMarketPlugin.installedVersion"><dt>已安装</dt><dd>v{{ selectedMarketPlugin.installedVersion }}</dd></div>
          <div v-if="selectedMarketPlugin.minAppVersion"><dt>最低版本</dt><dd>{{ selectedMarketPlugin.minAppVersion }}</dd></div>
          <div><dt>来源</dt><dd>{{ selectedMarketPlugin.source }}</dd></div>
          <div><dt>更新</dt><dd>{{ selectedMarketPlugin.updatedAt }}</dd></div>
        </dl>

        <section v-if="selectedPluginScreenshots.length > 0" class="plugin-detail-section plugin-screenshot-section">
          <h3>效果图</h3>
          <div class="plugin-screenshot-frame">
            <img :src="activePluginScreenshot" alt="插件效果图" draggable="false" />
            <template v-if="selectedPluginScreenshots.length > 1">
              <button class="plugin-screenshot-nav previous" type="button" aria-label="上一张效果图" @click="showPreviousScreenshot">
                <ChevronLeft :size="17" />
              </button>
              <button class="plugin-screenshot-nav next" type="button" aria-label="下一张效果图" @click="showNextScreenshot">
                <ChevronRight :size="17" />
              </button>
            </template>
          </div>
          <div v-if="selectedPluginScreenshots.length > 1" class="plugin-screenshot-dots" aria-label="效果图页码">
            <button
              v-for="(_, index) in selectedPluginScreenshots"
              :key="index"
              type="button"
              :class="{ active: activeScreenshotIndex === index }"
              :aria-label="`第 ${index + 1} 张效果图`"
              @click="selectScreenshot(index)"
            ></button>
          </div>
        </section>
      </aside>
    </div>

    <div v-else-if="activePluginCenterTab === 'installed'" class="plugin-installed-panel">
      <PluginBulkActions
        :busy="isBatchBusy"
        :enabled-count="selectedEnabledPlugins.length"
        :installable-count="selectedInstallablePlugins.length"
        :selected-count="selectedPlugins.length"
        @disable="batchDisableSelected"
        @install="batchInstallSelected"
        @uninstall="batchUninstallSelected"
      />

      <PluginTable
        :all-visible-selected="allVisibleSelected"
        :drag-over-plugin-id="dragOverPluginId"
        :dragging-plugin-id="draggingPluginId"
        :format-capabilities="formatCapabilities"
        :loading="isLoading"
        :plugins="visiblePlugins"
        :selected-plugin-ids="selectedPluginIds"
        @install="installPlugin"
        @remove="removePlugin"
        @select="setPluginSelected"
        @start-drag="startPluginPointerDrag"
        @start-row-drag="startPluginRowPointerDrag"
        @toggle="togglePlugin"
        @toggle-all="toggleAllVisiblePlugins"
        @update="updatePlugin"
      />
    </div>

    <div v-else class="plugin-subscriptions-panel">
      <PluginSubscriptionForm v-model="subscriptionUrl" :adding="isAddingSubscription" @add="addSubscription">
        <template #actions>
          <button class="secondary-button plugin-local-install-button" type="button" @click="importFromLocalFile">
            <FolderInput :size="16" />
            从本地文件安装
          </button>
        </template>
      </PluginSubscriptionForm>

      <div class="subscription-list visible">
        <div v-for="subscription in subscriptions" :key="subscription.id" class="subscription-card">
          <span class="subscription-card-body">
            <strong>{{ subscription.name }}</strong>
            <small>{{ subscription.url }}</small>
          </span>
          <span class="subscription-card-actions">
            <button class="subscription-action sync" type="button" :disabled="isSyncingSubscription(subscription.id)" :aria-label="`同步订阅 ${subscription.name}`" :title="`同步订阅 ${subscription.name}`" @click="syncSubscription(subscription)">
              <RefreshCw :class="{ spinning: isSyncingSubscription(subscription.id) }" :size="14" />
            </button>
            <button class="subscription-action delete" type="button" :aria-label="`删除订阅 ${subscription.name}`" :title="`删除订阅 ${subscription.name}`" @click="removeSubscription(subscription)">
              <Trash2 :size="14" />
            </button>
          </span>
        </div>
        <div v-if="subscriptions.length === 0" class="subscription-empty subscription-card">
          <strong>暂无订阅源</strong>
          <small>添加订阅后，商城会显示远程插件。</small>
        </div>
      </div>
    </div>

    <PluginLoadingOverlay v-if="isAddingSubscription" />
  </section>
</template>

<style scoped>
.plugin-manager-view {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 22px 28px 28px;
  background: var(--smw-bg-workspace);
}

:deep(.plugin-center-tabs) {
  display: flex;
  gap: 28px;
  align-items: center;
  min-height: 42px;
  margin: 0 0 16px;
  border-bottom: 1px solid var(--smw-border-soft);
}

:deep(.plugin-center-tabs button) {
  position: relative;
  height: 40px;
  padding: 0;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

:deep(.plugin-center-tabs button.active) {
  color: var(--smw-text-primary);
  font-weight: 720;
}

:deep(.plugin-center-tabs button.active::after) {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--smw-button-primary);
  content: "";
}

.plugin-market-shell {
  display: grid;
  grid-template-columns: 218px minmax(420px, 1fr) minmax(280px, 340px);
  gap: 16px;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.plugin-market-sidebar,
.plugin-market-main,
.plugin-detail-panel,
.plugin-installed-panel,
.plugin-subscriptions-panel {
  min-width: 0;
  min-height: 0;
}

.plugin-market-sidebar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-input) 70%, transparent);
}

.plugin-category-button {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.plugin-category-button:hover,
.plugin-category-button.active {
  border-color: color-mix(in srgb, var(--smw-border) 72%, transparent);
  background: var(--smw-bg-hover);
}

.plugin-category-button.active {
  color: var(--smw-text-primary);
  box-shadow: inset 2px 0 0 var(--smw-button-primary);
}

.plugin-category-button svg {
  color: var(--smw-icon-muted);
}

.plugin-category-button strong,
.plugin-category-button small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-category-button strong {
  font-size: 13px;
  font-weight: 700;
}

.plugin-category-button small {
  margin-top: 2px;
  color: var(--smw-text-secondary);
  font-size: 11px;
}

.plugin-market-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.plugin-market-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.plugin-market-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  min-width: 0;
  padding: 0 11px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
}

.plugin-market-search input {
  min-width: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  outline: none;
}

.plugin-market-search input {
  width: 100%;
}

.plugin-market-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.plugin-market-filters button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.plugin-market-filters button.active {
  border-color: transparent;
  color: #fff;
  background: var(--smw-button-primary);
}

.plugin-market-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.plugin-market-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) max-content;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    transform 140ms ease;
}

.plugin-market-card:hover,
.plugin-market-card.selected {
  border-color: color-mix(in srgb, var(--smw-button-primary) 32%, var(--smw-border));
  background: color-mix(in srgb, var(--smw-bg-selected) 48%, var(--smw-bg-input));
}

.plugin-market-card:hover {
  transform: translateY(-1px);
}

.plugin-card-icon {
  display: inline-grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--smw-border) 78%, transparent);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-selected) 55%, transparent);
}

.plugin-card-icon.detail {
  width: 46px;
  height: 46px;
}

.plugin-card-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.plugin-card-icon.music,
.plugin-card-icon.lyrics {
  color: var(--smw-button-primary);
}

.plugin-card-icon.metadata,
.plugin-card-icon.playlist {
  color: var(--smw-status-green);
}

.plugin-card-icon.theme,
.plugin-card-icon.integration,
.plugin-card-icon.tool {
  color: var(--smw-text-body);
}

.plugin-card-body,
.plugin-card-title-row,
.plugin-card-meta,
.plugin-card-description,
.plugin-card-tags {
  min-width: 0;
}

.plugin-card-body {
  display: grid;
  gap: 5px;
}

.plugin-card-title-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.plugin-card-title-row strong {
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-card-meta,
.plugin-card-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-card-meta {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.plugin-card-description {
  color: var(--smw-text-body);
  font-size: 13px;
}

.plugin-card-tags,
.plugin-chip-list,
.plugin-permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-card-tags span,
.plugin-chip-list span,
.plugin-permission-list span,
.plugin-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-selected) 50%, transparent);
  font-size: 11px;
  white-space: nowrap;
}

.plugin-status-badge.installed {
  color: var(--smw-status-green);
}

.plugin-status-badge.update {
  color: var(--smw-button-primary);
}

.plugin-card-action,
.plugin-detail-primary {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-panel);
  font-size: 12px;
  font-weight: 680;
  white-space: nowrap;
}

.plugin-card-action:not(:disabled),
.plugin-detail-primary:not(:disabled) {
  cursor: pointer;
}

.plugin-card-action.available,
.plugin-detail-primary {
  border-color: transparent;
  color: #fff;
  background: var(--smw-button-primary);
}

.plugin-card-action.installed,
.plugin-detail-primary:disabled {
  border-color: var(--smw-border-soft);
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-selected) 54%, transparent);
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.plugin-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-input);
}

.plugin-detail-heading {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.plugin-detail-heading h2,
.plugin-detail-heading p,
.plugin-detail-section h3,
.plugin-detail-section p,
.plugin-detail-meta,
.plugin-highlight-list {
  margin: 0;
}

.plugin-detail-heading h2 {
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 18px;
  font-weight: 760;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-detail-heading p,
.plugin-detail-section p,
.plugin-muted-text {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.plugin-detail-primary {
  width: 100%;
  height: 34px;
  border: 0;
  cursor: pointer;
}

.plugin-detail-primary:disabled {
  cursor: default;
}

.plugin-detail-section {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.plugin-detail-section h3 {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 740;
}

.plugin-highlight-list {
  display: grid;
  gap: 7px;
  padding-left: 18px;
  color: var(--smw-text-body);
  font-size: 12px;
  line-height: 1.45;
}

.plugin-detail-meta {
  display: grid;
  gap: 8px;
  padding-top: 2px;
  border-top: 1px solid var(--smw-border-soft);
}

.plugin-detail-meta div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
}

.plugin-detail-meta dt,
.plugin-detail-meta dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-detail-meta dt {
  color: var(--smw-text-secondary);
}

.plugin-detail-meta dd {
  color: var(--smw-text-body);
}

.plugin-screenshot-section {
  padding-top: 0;
}

.plugin-screenshot-frame {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.plugin-screenshot-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.plugin-screenshot-nav {
  position: absolute;
  top: 50%;
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--smw-border) 76%, transparent);
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-input) 88%, transparent);
  cursor: pointer;
  transform: translateY(-50%);
}

.plugin-screenshot-nav:hover {
  background: var(--smw-bg-input);
}

.plugin-screenshot-nav.previous {
  left: 8px;
}

.plugin-screenshot-nav.next {
  right: 8px;
}

.plugin-screenshot-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  min-height: 16px;
}

.plugin-screenshot-dots button {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--smw-text-secondary) 34%, transparent);
  cursor: pointer;
}

.plugin-screenshot-dots button.active {
  width: 16px;
  background: var(--smw-button-primary);
}

.plugin-installed-panel,
.plugin-subscriptions-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.plugin-subscriptions-panel {
  overflow: auto;
}

.plugin-local-install-button {
  height: 36px;
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

.subscription-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, max-content));
  gap: 8px 10px;
  align-items: start;
  margin: 2px 0 10px;
  min-height: 28px;
}

.subscription-list:not(.visible) {
  display: none;
}

.subscription-card {
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

.subscription-card-body {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.subscription-list strong,
.subscription-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-list strong {
  color: var(--smw-text-primary);
  font-size: 13px;
}

.subscription-list small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.subscription-card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.subscription-card:hover .subscription-card-actions,
.subscription-card:focus-within .subscription-card-actions {
  opacity: 1;
  pointer-events: auto;
}

.subscription-action {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.subscription-action:hover,
.subscription-action:focus-visible {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  outline: none;
}

.subscription-action.delete:hover,
.subscription-action.delete:focus-visible {
  border-color: color-mix(in srgb, var(--smw-status-red, #d64545) 34%, var(--smw-border));
  color: var(--smw-status-red, #d64545);
  background: color-mix(in srgb, var(--smw-status-red, #d64545) 8%, transparent);
}

.subscription-action:disabled {
  cursor: default;
  opacity: 0.62;
}


@media (max-width: 1180px) {
  .plugin-market-shell {
    grid-template-columns: 190px minmax(0, 1fr);
  }

  .plugin-detail-panel {
    display: none;
  }
}

@media (max-width: 860px) {
  .plugin-header {
    display: grid;
    padding-right: 0;
  }

  .plugin-manager-view {
    overflow: auto;
    padding: 18px;
  }

  .plugin-market-shell,
  .plugin-market-toolbar {
    grid-template-columns: 1fr;
  }

  .plugin-market-sidebar {
    flex-direction: row;
    overflow-x: auto;
  }

  .plugin-category-button {
    min-width: 170px;
  }

  .plugin-market-card {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .plugin-card-action {
    grid-column: 2;
    justify-self: start;
  }
}
</style>


