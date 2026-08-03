import type { PluginMarketCategory, PluginMarketItem, PluginMarketStatus } from '../composables/usePluginMarket';
import type { PluginRow } from '../components/plugin-manager/types';
import type { PluginCapability, PluginCatalogItem, PluginManifest, PluginSubscription } from './plugin';

export interface PluginMarketPanelProps {
  activeCategory: PluginMarketCategory;
  activeScreenshot: string;
  activeScreenshotIndex: number;
  activeStatus: 'all' | PluginMarketStatus;
  categories: Array<{ id: PluginMarketCategory; label: string; description: string }>;
  isInstallingPlugin: (pluginId: string) => boolean;
  loading: boolean;
  localizedCapability: (capability: string) => string;
  localizedPermission: (permission: string) => string;
  pluginActionLabel: (plugin: PluginMarketItem) => string;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
  pluginStatusLabel: (status: PluginMarketStatus) => string;
  plugins: PluginMarketItem[];
  search: string;
  selectedPlugin: PluginMarketItem | null;
  screenshots: string[];
  statusFilters: Array<{ id: 'all' | PluginMarketStatus; label: string }>;
}

export interface PluginMarketPanelEmits {
  action: [plugin: PluginMarketItem];
  nextScreenshot: [];
  previousScreenshot: [];
  selectCategory: [category: PluginMarketCategory];
  selectPlugin: [plugin: PluginMarketItem];
  selectScreenshot: [index: number];
  'update:activeStatus': [status: 'all' | PluginMarketStatus];
  'update:search': [value: string];
}

export interface PluginMarketPanelListeners {
  onAction: (...args: PluginMarketPanelEmits['action']) => void;
  onNextScreenshot: () => void;
  onPreviousScreenshot: () => void;
  onSelectCategory: (...args: PluginMarketPanelEmits['selectCategory']) => void;
  onSelectPlugin: (...args: PluginMarketPanelEmits['selectPlugin']) => void;
  onSelectScreenshot: (...args: PluginMarketPanelEmits['selectScreenshot']) => void;
  'onUpdate:activeStatus': (...args: PluginMarketPanelEmits['update:activeStatus']) => void;
  'onUpdate:search': (...args: PluginMarketPanelEmits['update:search']) => void;
}

export interface PluginInstalledPanelProps {
  allVisibleSelected: boolean;
  busy: boolean;
  dragOverPluginId: string | null;
  draggingPluginId: string | null;
  enabledCount: number;
  formatCapabilities: (capabilities: PluginCapability[], installed?: boolean) => string;
  installableCount: number;
  loading: boolean;
  plugins: PluginRow[];
  selectedCount: number;
  selectedPluginIds: Set<string>;
}

export interface PluginInstalledPanelEmits {
  batchDisable: [];
  batchInstall: [];
  batchUninstall: [];
  install: [item: PluginCatalogItem];
  remove: [pluginId: string, pluginName: string];
  select: [pluginId: string, selected: boolean];
  startDrag: [event: PointerEvent, plugin: PluginRow];
  startRowDrag: [event: PointerEvent, plugin: PluginRow];
  toggle: [plugin: PluginManifest];
  toggleAll: [];
  update: [item: PluginCatalogItem];
}

export interface PluginInstalledPanelListeners {
  onBatchDisable: () => void;
  onBatchInstall: () => void;
  onBatchUninstall: () => void;
  onInstall: (...args: PluginInstalledPanelEmits['install']) => void;
  onRemove: (...args: PluginInstalledPanelEmits['remove']) => void;
  onSelect: (...args: PluginInstalledPanelEmits['select']) => void;
  onStartDrag: (...args: PluginInstalledPanelEmits['startDrag']) => void;
  onStartRowDrag: (...args: PluginInstalledPanelEmits['startRowDrag']) => void;
  onToggle: (...args: PluginInstalledPanelEmits['toggle']) => void;
  onToggleAll: () => void;
  onUpdate: (...args: PluginInstalledPanelEmits['update']) => void;
}

export interface PluginSubscriptionsPanelProps {
  adding: boolean;
  isSyncingSubscription: (subscriptionId: string) => boolean;
  modelValue: string;
  subscriptions: PluginSubscription[];
}

export interface PluginSubscriptionsPanelEmits {
  add: [];
  importLocalFile: [];
  remove: [subscription: PluginSubscription];
  sync: [subscription: PluginSubscription];
  'update:modelValue': [value: string];
}

export interface PluginSubscriptionsPanelListeners {
  onAdd: () => void;
  onImportLocalFile: () => void;
  onRemove: (...args: PluginSubscriptionsPanelEmits['remove']) => void;
  onSync: (...args: PluginSubscriptionsPanelEmits['sync']) => void;
  'onUpdate:modelValue': (...args: PluginSubscriptionsPanelEmits['update:modelValue']) => void;
}
