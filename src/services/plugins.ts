import type {
  PluginCapability,
  PluginCatalogItem,
  PluginKind,
  PluginManifest,
  PluginPermission,
  PluginRuntime,
  PluginSubscription,
} from '../types/plugin';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './music';
import { readPersistentValue, writePersistentValue } from './persistentStore';

const INSTALLED_PLUGINS_KEY = 'plugins.installed';
const PLUGIN_SUBSCRIPTIONS_KEY = 'plugins.subscriptions';
const DELETED_PLUGINS_KEY = 'plugins.deleted';
const PLUGIN_CATALOG_CACHE_KEY = 'plugins.catalog.cache';
const MUSIC_PLUGIN_CAPABILITIES = ['search', 'play', 'lyrics'] satisfies PluginCapability[];
const ALLOWED_PLUGIN_CAPABILITIES = new Set<PluginCapability>(['search', 'play', 'lyrics']);

interface RawCatalogPlugin {
  id?: string;
  name?: string;
  url?: string;
  entry?: string;
  version?: string;
  kind?: PluginKind;
  author?: string;
  description?: string;
  runtime?: PluginRuntime;
  capabilities?: string[];
  permissions?: PluginPermission[];
}

interface RawPluginCatalog {
  desc?: string;
  name?: string;
  plugins?: RawCatalogPlugin[];
}

interface PluginMetadata {
  id?: string;
  name?: string;
  version?: string;
  kind?: PluginKind;
  author?: string;
  description?: string;
  capabilities?: string[];
  permissions?: PluginPermission[];
}

function makePluginId(name: string, sourceUrl: string) {
  const slug = `${name}-${sourceUrl}`
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || crypto.randomUUID();
}

function inferRuntime(declaredRuntime?: PluginRuntime): PluginRuntime {
  if (declaredRuntime) return declaredRuntime;
  return 'wasm';
}

function inferKind(kind?: PluginKind, capabilities?: PluginCapability[]): PluginKind {
  if (kind) return kind;
  return capabilities?.includes('play') ? 'music' : 'lyrics';
}

function isDirectPluginUrl(url: string) {
  const path = url.split('?')[0]?.toLowerCase() ?? url.toLowerCase();
  return path.endsWith('.wasm');
}

function inferPluginNameFromUrl(url: string) {
  const path = url.split('?')[0] ?? url;
  return decodeURIComponent(path.split('/').pop() ?? '')
    .replace(/\.wasm$/i, '')
    .trim();
}

function inferDirectPluginCapabilities(name: string) {
  return name.toLowerCase().includes('lyrics')
    ? (['search', 'lyrics'] satisfies PluginCapability[])
    : inferCapabilities();
}

function inferCapabilities(capabilities?: string[]) {
  const normalizedCapabilities = (capabilities ?? [])
    .filter((capability): capability is PluginCapability => ALLOWED_PLUGIN_CAPABILITIES.has(capability as PluginCapability));
  if (normalizedCapabilities.length) return normalizedCapabilities;
  return MUSIC_PLUGIN_CAPABILITIES;
}

function inferPermissions(permissions?: PluginPermission[]) {
  return permissions?.length ? permissions : (['network'] satisfies PluginPermission[]);
}

function toCatalogItem(raw: RawCatalogPlugin): PluginCatalogItem | null {
  const sourceUrl = raw.url ?? raw.entry;
  const name = raw.name?.trim();
  if (!sourceUrl || !name) return null;

  const runtime = inferRuntime(raw.runtime);
  const capabilities = inferCapabilities(raw.capabilities);
  if (!sourceUrl.split('?')[0]?.toLowerCase().endsWith('.wasm')) return null;

  return {
    id: raw.id ?? makePluginId(name, sourceUrl),
    name,
    version: raw.version ?? '0.0.0',
    kind: inferKind(raw.kind, capabilities),
    runtime,
    entry: sourceUrl,
    author: raw.author,
    description: raw.description,
    capabilities,
    permissions: inferPermissions(raw.permissions),
    sourceUrl,
  };
}

export async function listPluginSubscriptions(): Promise<PluginSubscription[]> {
  const stored = await readPersistentValue<PluginSubscription[]>(PLUGIN_SUBSCRIPTIONS_KEY);
  return stored ?? [];
}

export async function savePluginSubscriptions(subscriptions: PluginSubscription[]): Promise<void> {
  await writePersistentValue(PLUGIN_SUBSCRIPTIONS_KEY, subscriptions);
}

export async function listCachedPluginCatalog(): Promise<PluginCatalogItem[]> {
  return mergeCatalogPlugins([
    ...((await readPersistentValue<PluginCatalogItem[]>(PLUGIN_CATALOG_CACHE_KEY)) ?? [])
      .filter(isWasmCatalogItem)
      .map(normalizeCatalogItem),
  ]);
}

export async function saveCachedPluginCatalog(plugins: PluginCatalogItem[]): Promise<void> {
  const deletedPluginIds = new Set(await listDeletedPluginIds());
  await writePersistentValue(
    PLUGIN_CATALOG_CACHE_KEY,
    plugins
      .filter((plugin) => isWasmCatalogItem(plugin) && !deletedPluginIds.has(plugin.id))
      .map(normalizeCatalogItem),
  );
}

export async function addPluginSubscription(url: string): Promise<PluginSubscription[]> {
  const storedSubscriptions = (await readPersistentValue<PluginSubscription[]>(PLUGIN_SUBSCRIPTIONS_KEY)) ?? [];
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return listPluginSubscriptions();
  const subscription = {
    id: crypto.randomUUID(),
    name: new URL(normalizedUrl).hostname,
    url: normalizedUrl,
  };

  if (storedSubscriptions.some((item) => item.url === normalizedUrl)) return storedSubscriptions;

  const nextSubscriptions = [
    ...storedSubscriptions,
    subscription,
  ];
  await savePluginSubscriptions(nextSubscriptions);
  return nextSubscriptions;
}

export async function listInstalledPlugins(): Promise<PluginManifest[]> {
  const storedPlugins = (await readPersistentValue<PluginManifest[]>(INSTALLED_PLUGINS_KEY)) ?? [];
  const normalizedPlugins = storedPlugins
    .filter((plugin) => plugin.runtime === 'wasm')
    .map(normalizePluginManifest);
  if (JSON.stringify(storedPlugins) !== JSON.stringify(normalizedPlugins)) {
    await saveInstalledPlugins(normalizedPlugins);
  }
  return normalizedPlugins;
}

export async function saveInstalledPlugins(plugins: PluginManifest[]): Promise<void> {
  await writePersistentValue(INSTALLED_PLUGINS_KEY, plugins.map(normalizePluginManifest));
}

export async function listDeletedPluginIds(): Promise<string[]> {
  return (await readPersistentValue<string[]>(DELETED_PLUGINS_KEY)) ?? [];
}

async function saveDeletedPluginIds(pluginIds: string[]): Promise<void> {
  await writePersistentValue(DELETED_PLUGINS_KEY, [...new Set(pluginIds)]);
}

async function restoreDeletedPlugin(pluginId: string): Promise<void> {
  const deletedPluginIds = await listDeletedPluginIds();
  if (!deletedPluginIds.includes(pluginId)) return;
  await saveDeletedPluginIds(deletedPluginIds.filter((id) => id !== pluginId));
}

async function markPluginDeleted(pluginId: string): Promise<void> {
  const deletedPluginIds = await listDeletedPluginIds();
  await saveDeletedPluginIds([...deletedPluginIds, pluginId]);
}

export async function restoreDeletedPluginsFromCatalog(plugins: PluginCatalogItem[]): Promise<void> {
  const pluginIds = new Set(plugins.map((plugin) => plugin.id));
  if (pluginIds.size === 0) return;

  const deletedPluginIds = await listDeletedPluginIds();
  await saveDeletedPluginIds(deletedPluginIds.filter((pluginId) => !pluginIds.has(pluginId)));
}

async function readPluginMetadata(entry: string, permissions?: PluginPermission[]): Promise<PluginMetadata | null> {
  if (!isTauriRuntime()) return null;
  try {
    const response = await invoke<PluginMetadata>('plugin_invoke', {
      entry,
      request: { action: 'metadata' },
      pluginId: null,
      permissions: permissions ?? ['network'],
    });
    return response && typeof response === 'object' ? response : null;
  } catch {
    return null;
  }
}

function mergePluginMetadata(item: PluginCatalogItem, metadata: PluginMetadata | null): PluginCatalogItem {
  if (!metadata) return item;
  const capabilities = inferCapabilities(metadata.capabilities ?? item.capabilities);
  return {
    ...item,
    id: metadata.id?.trim() || item.id,
    name: metadata.name?.trim() || item.name,
    version: metadata.version?.trim() || item.version,
    kind: inferKind(metadata.kind ?? item.kind, capabilities),
    author: metadata.author?.trim() || item.author,
    description: metadata.description?.trim() || item.description,
    capabilities,
    permissions: inferPermissions(metadata.permissions ?? item.permissions),
  };
}

export async function installCatalogPlugin(item: PluginCatalogItem): Promise<PluginManifest[]> {
  const installed = await listInstalledPlugins();
  const pluginItem = mergePluginMetadata(item, await readPluginMetadata(item.entry, item.permissions));
  const capabilities = await detectInstallCapabilities(pluginItem);
  const manifest: PluginManifest = {
    id: pluginItem.id,
    name: pluginItem.name,
    version: pluginItem.version,
    kind: pluginItem.kind,
    runtime: pluginItem.runtime,
    entry: pluginItem.entry,
    author: pluginItem.author,
    description: pluginItem.description,
    capabilities,
    permissions: pluginItem.permissions,
    sourceUrl: pluginItem.sourceUrl,
    installedAt: new Date().toISOString(),
    enabled: true,
  };
  const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== pluginItem.id)];
  await restoreDeletedPlugin(pluginItem.id);
  await saveInstalledPlugins(nextInstalled);
  return nextInstalled;
}

export async function installLocalPlugin(filePath: string): Promise<PluginManifest[]> {
  if (!filePath.toLowerCase().endsWith('.wasm')) {
    throw new Error('只支持导入 WASM 插件。');
  }

  const name = filePath.split(/[\\/]/).pop()?.replace(/\.wasm$/i, '') || 'Local Plugin';
  const runtime: PluginRuntime = 'wasm';
  const id = makePluginId(name, filePath);
  const fallbackCapabilities = inferDirectPluginCapabilities(name);
  const metadata = await readPluginMetadata(filePath, ['network']);
  const capabilities = inferCapabilities(metadata?.capabilities ?? fallbackCapabilities);
  const installed = await listInstalledPlugins();
  const manifest: PluginManifest = {
    id,
    name: metadata?.name?.trim() || name,
    version: metadata?.version?.trim() || '0.0.0',
    kind: inferKind(metadata?.kind, capabilities),
    runtime,
    entry: filePath,
    author: metadata?.author?.trim(),
    description: metadata?.description?.trim(),
    capabilities,
    permissions: ['network'],
    sourceUrl: filePath,
    installedAt: new Date().toISOString(),
    enabled: true,
  };
  const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== id)];
  await restoreDeletedPlugin(id);
  await saveInstalledPlugins(nextInstalled);
  return nextInstalled;
}

async function detectInstallCapabilities(item: PluginCatalogItem) {
  return item.capabilities;
}

export async function uninstallPlugin(pluginId: string): Promise<PluginManifest[]> {
  const installed = await listInstalledPlugins();
  const nextInstalled = installed.filter((plugin) => plugin.id !== pluginId);
  await markPluginDeleted(pluginId);
  await saveInstalledPlugins(nextInstalled);
  const cachedPlugins = await listCachedPluginCatalog();
  await saveCachedPluginCatalog(cachedPlugins.filter((plugin) => plugin.id !== pluginId));
  return nextInstalled;
}

export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<PluginManifest[]> {
  const installed = await listInstalledPlugins();
  const nextInstalled = installed.map((plugin) => plugin.id === pluginId ? { ...plugin, enabled } : plugin);
  await saveInstalledPlugins(nextInstalled);
  return nextInstalled;
}

export async function fetchPluginCatalog(subscription: PluginSubscription): Promise<PluginCatalogItem[]> {
  if (isDirectPluginUrl(subscription.url)) {
    const runtime = inferRuntime();
    const name = inferPluginNameFromUrl(subscription.url) || subscription.name;
    const fallbackCapabilities = inferDirectPluginCapabilities(name);
    const metadata = await readPluginMetadata(subscription.url, inferPermissions());
    const capabilities = inferCapabilities(metadata?.capabilities ?? fallbackCapabilities);

    return [{
      id: metadata?.id?.trim() || makePluginId(name, subscription.url),
      name: metadata?.name?.trim() || name,
      version: metadata?.version?.trim() || '0.0.0',
      kind: inferKind(metadata?.kind, capabilities),
      runtime,
      entry: subscription.url,
      author: metadata?.author?.trim(),
      description: metadata?.description?.trim(),
      capabilities,
      permissions: inferPermissions(),
      sourceUrl: subscription.url,
    }];
  }

  const catalogText = isTauriRuntime()
    ? await invoke<string>('fetch_plugin_catalog', { url: subscription.url })
    : await fetch(subscription.url, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    });

  const catalog = JSON.parse(catalogText) as RawPluginCatalog | RawCatalogPlugin[];
  const plugins = Array.isArray(catalog) ? catalog : (catalog.plugins ?? []);
  return plugins
    .map(toCatalogItem)
    .filter((item): item is PluginCatalogItem => Boolean(item));
}

function isWasmCatalogItem(plugin: PluginCatalogItem) {
  return plugin.runtime === 'wasm';
}

export async function fetchAllPluginCatalogs(subscriptions: PluginSubscription[]): Promise<PluginCatalogItem[]> {
  const results = await Promise.allSettled(subscriptions.map(fetchPluginCatalog));
  const catalogs = results
    .filter((result): result is PromiseFulfilledResult<PluginCatalogItem[]> => result.status === 'fulfilled')
    .map((result) => result.value);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

  failures.forEach((failure, index) => {
    console.warn(`[PluginSubscription:${subscriptions[index]?.url ?? 'unknown'}] fetch failed`, failure.reason);
  });

  if (catalogs.length === 0 && failures.length > 0) {
    throw new Error(failures[0].reason instanceof Error ? failures[0].reason.message : '插件订阅更新失败');
  }

  const itemById = new Map<string, PluginCatalogItem>();

  for (const item of catalogs.flat()) {
    itemById.set(item.id, item);
  }

  return [...itemById.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function mergeCatalogPlugins(plugins: PluginCatalogItem[]) {
  const itemById = new Map<string, PluginCatalogItem>();
  for (const plugin of plugins) {
    itemById.set(plugin.id, normalizeCatalogItem(plugin));
  }

  return [...itemById.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function normalizeCatalogItem(plugin: PluginCatalogItem): PluginCatalogItem {
  const capabilities = inferCapabilities(plugin.capabilities);
  return {
    ...plugin,
    kind: inferKind(plugin.kind, capabilities),
    capabilities,
  };
}

function normalizePluginManifest(plugin: PluginManifest): PluginManifest {
  const capabilities = inferCapabilities(plugin.capabilities);
  return {
    ...plugin,
    kind: inferKind(plugin.kind, capabilities),
    capabilities,
  };
}





