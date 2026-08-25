import type {
  PluginConfig,
  PluginConfigMap,
  PluginCatalogItem,
  PluginManifest,
  PluginSubscription,
  PluginThemePayload,
} from '../types/plugin';
import { invokeApi } from './api';
import { isTauriRuntime } from './music';
import { readPersistentValue, writePersistentValue } from './persistentStore';

const INSTALLED_PLUGINS_KEY = 'plugins.installed';
const PLUGIN_SUBSCRIPTIONS_KEY = 'plugins.subscriptions';
const PLUGIN_CONFIGS_KEY = 'plugins.configs';
const DELETED_PLUGINS_KEY = 'plugins.deleted';
const PLUGIN_CATALOG_CACHE_KEY = 'plugins.catalog.cache';
let pluginMutationQueue: Promise<void> = Promise.resolve();

function runPluginMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const run = pluginMutationQueue.then(mutation, mutation);
  pluginMutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

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
  const configs = await listPluginConfigs();
  return normalizedPlugins.map((plugin) => ({
    ...plugin,
    config: { ...defaultPluginConfig(plugin), ...(configs[plugin.id] ?? {}) },
  }));
}

export async function saveInstalledPlugins(plugins: PluginManifest[]): Promise<void> {
  await writePersistentValue(INSTALLED_PLUGINS_KEY, await normalizeManifests(plugins));
}

function normalizePluginConfig(value: unknown): PluginConfig {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, configValue]) => [key.trim(), normalizePluginConfigValue(configValue)] as const)
      .filter(([key, configValue]) => key && configValue !== undefined && configValue !== null && configValue !== '' && (!Array.isArray(configValue) || configValue.length > 0)),
  );
}

function normalizePluginConfigValue(value: unknown): PluginConfig[string] {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  }
  return undefined;
}

function normalizePluginConfigMap(value: unknown): PluginConfigMap {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([pluginId, config]) => [pluginId, normalizePluginConfig(config)] as const)
      .filter(([pluginId, config]) => pluginId.trim() && Object.keys(config).length > 0),
  );
}

function defaultPluginConfig(plugin: PluginManifest): PluginConfig {
  return Object.fromEntries(
    (plugin.configSchema?.fields ?? [])
      .filter((field) => field.defaultValue !== undefined && field.defaultValue !== null)
      .map((field) => [field.key, normalizePluginConfigValue(field.defaultValue)] as const)
      .filter(([key, value]) => key.trim() && value !== undefined),
  );
}

export async function listPluginConfigs(): Promise<PluginConfigMap> {
  return normalizePluginConfigMap(await readPersistentValue<PluginConfigMap>(PLUGIN_CONFIGS_KEY));
}

export async function savePluginConfig(pluginId: string, config: PluginConfig): Promise<PluginConfigMap> {
  const normalizedPluginId = pluginId.trim();
  if (!normalizedPluginId) return listPluginConfigs();
  const configs = await listPluginConfigs();
  const normalizedConfig = normalizePluginConfig(config);
  const nextConfigs = { ...configs };
  if (Object.keys(normalizedConfig).length > 0) {
    nextConfigs[normalizedPluginId] = normalizedConfig;
  } else {
    delete nextConfigs[normalizedPluginId];
  }
  await writePersistentValue(PLUGIN_CONFIGS_KEY, nextConfigs);
  return nextConfigs;
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
  return runPluginMutation(async () => {
    const manifest = await invokeApi<PluginManifest>('build_plugin_manifest_from_catalog', {
      item,
      installedAt: new Date().toISOString(),
      enabled: true,
    });
    const installed = await listInstalledPlugins();
    const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== manifest.id)];
    await restoreDeletedPlugin(manifest.id);
    await saveInstalledPlugins(nextInstalled);
    return nextInstalled;
  });
}

export async function installLocalPlugin(filePath: string): Promise<PluginManifest[]> {
  if (!filePath.toLowerCase().endsWith('.wasm')) {
    throw new Error('只支持导入 WASM 插件。');
  }

  return runPluginMutation(async () => {
    const manifest = await invokeApi<PluginManifest>('build_local_plugin_manifest', {
      filePath,
      installedAt: new Date().toISOString(),
      enabled: true,
    });
    const installed = await listInstalledPlugins();
    const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== manifest.id)];
    await restoreDeletedPlugin(manifest.id);
    await saveInstalledPlugins(nextInstalled);
    return nextInstalled;
  });
}

export async function installLocalLyricsRendererManifest(filePath: string): Promise<PluginManifest[]> {
  if (!filePath.toLowerCase().endsWith('.json')) throw new Error('歌词渲染插件 manifest 必须是 JSON 文件。');
  const raw = await invokeApi<string>('read_local_plugin_manifest', { filePath });
  const value = JSON.parse(raw) as Partial<PluginManifest>;
  if (value.runtime !== 'module' || value.kind !== 'lyrics-renderer' || !value.capabilities?.includes('lyrics-renderer')) {
    throw new Error('manifest 必须声明 runtime=module、kind=lyrics-renderer 和 lyrics-renderer capability。');
  }
  if (!value.id || !value.name || !value.entry) throw new Error('manifest 缺少 id、name 或 entry。');
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const base = slash >= 0 ? filePath.slice(0, slash + 1) : '';
  const entry = /^(https?:|asset:|\/|[a-zA-Z]:[\\/]|\\\\)/.test(value.entry) ? value.entry : `${base}${value.entry}`;
  const manifest: PluginManifest = {
    id: value.id,
    name: value.name,
    version: value.version ?? '0.0.0',
    kind: 'lyrics-renderer',
    runtime: 'module',
    entry,
    author: value.author ?? 'Local',
    description: value.description ?? '',
    icon: value.icon,
    updatedAt: value.updatedAt ?? new Date().toISOString(),
    capabilities: ['lyrics-renderer'],
    tags: value.tags,
    highlights: value.highlights,
    screenshots: value.screenshots,
    permissions: value.permissions ?? [],
    sourceUrl: filePath,
    sourceKind: 'local',
    installedAt: new Date().toISOString(),
    enabled: true,
    configSchema: value.configSchema,
  };
  return runPluginMutation(async () => {
    const installed = await listInstalledPlugins();
    const nextInstalled = [manifest, ...installed.filter((plugin) => plugin.id !== manifest.id)];
    await restoreDeletedPlugin(manifest.id);
    await saveInstalledPlugins(nextInstalled);
    return nextInstalled;
  });
}

function isAbsolutePluginAsset(value: string) {
  return /^(https?:|data:|blob:|\/|[a-zA-Z]:[\\/]|\\\\)/.test(value);
}

function resolvePluginAsset(value: string | null | undefined, entry: string): string | null | undefined {
  const asset = value?.trim();
  if (!asset || isAbsolutePluginAsset(asset)) return value;
  if (asset === '.' || asset === '..' || asset.includes('../') || asset.includes('..\\')) return value;

  if (/^https?:/i.test(entry)) {
    try {
      return new URL(asset, new URL('.', entry)).toString();
    } catch {
      return value;
    }
  }

  const index = Math.max(entry.lastIndexOf('/'), entry.lastIndexOf('\\'));
  if (index < 0) return value;
  const separator = entry.includes('\\') ? '\\' : '/';
  return `${entry.slice(0, index)}${separator}${asset.replace(/[\\/]+/g, separator)}`;
}

export async function readPluginTheme(manifest: PluginManifest): Promise<PluginThemePayload> {
  if (manifest.kind !== 'theme' || !manifest.capabilities.includes('theme')) {
    throw new Error('插件不是主题插件');
  }

  const theme = await invokeApi<PluginThemePayload>('plugin_invoke', {
    entry: manifest.entry,
    request: { action: 'theme' },
    pluginId: manifest.id,
    permissions: manifest.permissions,
  });
  if (!theme.variables || Object.keys(theme.variables).length === 0) {
    throw new Error('主题插件没有返回主题变量');
  }
  return {
    ...theme,
    preview: resolvePluginAsset(theme.preview, manifest.entry),
    background: resolvePluginAsset(theme.background, manifest.entry),
  };
}

export async function uninstallPlugin(pluginId: string): Promise<PluginManifest[]> {
  const installed = await listInstalledPlugins();
  const nextInstalled = installed.filter((plugin) => plugin.id !== pluginId);
  if (isTauriRuntime()) {
    await invokeApi<void>('remove_plugin_package', { pluginId });
  }
  await markPluginDeleted(pluginId);
  await saveInstalledPlugins(nextInstalled);
  await savePluginConfig(pluginId, {});
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

  return invokeApi<PluginCatalogItem[]>('fetch_plugin_catalog_items', { url: subscription.url });
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
  return invokeApi<PluginCatalogItem[]>('normalize_plugin_catalog_items', { plugins });
}

function normalizeManifests(plugins: PluginManifest[]): Promise<PluginManifest[]> {
  return invokeApi<PluginManifest[]>('normalize_plugin_manifests', { plugins });
}





