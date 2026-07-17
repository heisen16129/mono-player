import type {
  PluginCatalogItem,
  PluginManifest,
  PluginSubscription,
} from '../types/plugin';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './music';
import { readPersistentValue, writePersistentValue } from './persistentStore';

const INSTALLED_PLUGINS_KEY = 'plugins.installed';
const PLUGIN_SUBSCRIPTIONS_KEY = 'plugins.subscriptions';
const DELETED_PLUGINS_KEY = 'plugins.deleted';
const PLUGIN_CATALOG_CACHE_KEY = 'plugins.catalog.cache';

export async function listPluginSubscriptions(): Promise<PluginSubscription[]> {
  const stored = await readPersistentValue<PluginSubscription[]>(PLUGIN_SUBSCRIPTIONS_KEY);
  return stored ?? [];
}

export async function savePluginSubscriptions(subscriptions: PluginSubscription[]): Promise<void> {
  await writePersistentValue(PLUGIN_SUBSCRIPTIONS_KEY, subscriptions);
}

export async function listCachedPluginCatalog(): Promise<PluginCatalogItem[]> {
  return mergeCatalogPlugins(await normalizeCatalogItems((await readPersistentValue<PluginCatalogItem[]>(PLUGIN_CATALOG_CACHE_KEY)) ?? []));
}

export async function saveCachedPluginCatalog(plugins: PluginCatalogItem[]): Promise<void> {
  const deletedPluginIds = new Set(await listDeletedPluginIds());
  await writePersistentValue(
    PLUGIN_CATALOG_CACHE_KEY,
    (await normalizeCatalogItems(plugins)).filter((plugin) => !deletedPluginIds.has(plugin.id)),
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
  const normalizedPlugins = await normalizeManifests(storedPlugins);
  if (JSON.stringify(storedPlugins) !== JSON.stringify(normalizedPlugins)) {
    await saveInstalledPlugins(normalizedPlugins);
  }
  return normalizedPlugins;
}

export async function saveInstalledPlugins(plugins: PluginManifest[]): Promise<void> {
  await writePersistentValue(INSTALLED_PLUGINS_KEY, await normalizeManifests(plugins));
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

export async function installCatalogPlugin(item: PluginCatalogItem): Promise<PluginManifest[]> {
  const installed = await listInstalledPlugins();
  const manifest = await invoke<PluginManifest>('build_plugin_manifest_from_catalog', {
    item,
    installedAt: new Date().toISOString(),
    enabled: true,
  });
  const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== manifest.id)];
  await restoreDeletedPlugin(manifest.id);
  await saveInstalledPlugins(nextInstalled);
  return nextInstalled;
}

export async function installLocalPlugin(filePath: string): Promise<PluginManifest[]> {
  if (!filePath.toLowerCase().endsWith('.wasm')) {
    throw new Error('只支持导入 WASM 插件。');
  }

  const installed = await listInstalledPlugins();
  const manifest = await invoke<PluginManifest>('build_local_plugin_manifest', {
    filePath,
    installedAt: new Date().toISOString(),
    enabled: true,
  });
  const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== manifest.id)];
  await restoreDeletedPlugin(manifest.id);
  await saveInstalledPlugins(nextInstalled);
  return nextInstalled;
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
  if (!isTauriRuntime()) {
    throw new Error('插件目录需要桌面运行时读取 WASM metadata。');
  }

  return invoke<PluginCatalogItem[]>('fetch_plugin_catalog_items', { url: subscription.url });
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
    itemById.set(plugin.id, plugin);
  }

  return [...itemById.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function normalizeCatalogItems(plugins: PluginCatalogItem[]): Promise<PluginCatalogItem[]> {
  return invoke<PluginCatalogItem[]>('normalize_plugin_catalog_items', { plugins });
}

function normalizeManifests(plugins: PluginManifest[]): Promise<PluginManifest[]> {
  return invoke<PluginManifest[]>('normalize_plugin_manifests', { plugins });
}





