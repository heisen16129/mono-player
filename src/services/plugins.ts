import type {
  PluginConfig,
  PluginCatalogItem,
  PluginManifest,
  PluginSubscription,
} from '../types/plugin';
import { listen } from '@tauri-apps/api/event';
import { invokeApi } from './api';
import { isTauriRuntime } from './music';
export interface PluginCatalogSnapshot {
  subscriptions: PluginSubscription[];
  catalog: PluginCatalogItem[];
  official: PluginCatalogItem[];
  deletedIds: string[];
  errors: Array<{ id: string; url: string; error: string }>;
}

export function pluginCatalog(action = 'snapshot', id?: string, url?: string): Promise<PluginCatalogSnapshot> {
  return invokeApi('plugin_catalog', { action, id, url });
}

export async function listPluginSubscriptions(): Promise<PluginSubscription[]> {
  return (await pluginCatalog()).subscriptions;
}

export async function listInstalledPlugins(): Promise<PluginManifest[]> {
  return invokeApi<PluginManifest[]>('plugin_list', { withConfig: true });
}

export async function listInstalledPluginManifests(purpose?: 'music-search' | 'lyrics-search' | 'desktop-lyrics'): Promise<PluginManifest[]> {
  return invokeApi<PluginManifest[]>('plugin_list', { withConfig: false, purpose });
}

export async function getPluginConfig(pluginId: string): Promise<PluginConfig> {
  const normalizedPluginId = pluginId.trim();
  if (!normalizedPluginId || !isTauriRuntime()) return {};
  return invokeApi<PluginConfig>('plugin_config_get', { pluginId: normalizedPluginId });
}

export async function savePluginConfig(pluginId: string, config: PluginConfig): Promise<PluginConfig> {
  const normalizedPluginId = pluginId.trim();
  if (!normalizedPluginId) return {};
  if (!isTauriRuntime()) return config;
  return invokeApi<PluginConfig>('plugin_config_set', { pluginId: normalizedPluginId, config });
}

export async function getInstalledPlugin(pluginId: string): Promise<PluginManifest | null> {
  const normalizedPluginId = pluginId.trim();
  if (!normalizedPluginId) return null;
  return (await listInstalledPlugins()).find(plugin => plugin.id === normalizedPluginId) ?? null;
}

export interface PluginAction {
  action: 'install' | 'update' | 'enabled' | 'uninstall';
  id?: string;
  item?: PluginCatalogItem;
  filePath?: string;
  enabled?: boolean;
}

export interface PluginBatchResult { index: number; id: string; success: boolean; error: string | null }

export async function batchPluginActions(requests: PluginAction[], onProgress?: (completed: number, total: number) => void): Promise<PluginBatchResult[]> {
  const requestId = crypto.randomUUID();
  const unlisten = await listen<{ requestId: string; completed: number; total: number }>('plugins://batch', event => {
    if (event.payload.requestId === requestId) onProgress?.(event.payload.completed, event.payload.total);
  });
  try { return await invokeApi('plugin_batch', { requestId, requests }); }
  finally { unlisten(); }
}

export function installCatalogPlugin(item: PluginCatalogItem, update = false): Promise<PluginManifest[]> {
  return invokeApi('plugin_action', { request: { action: update ? 'update' : 'install', item } });
}

export function installLocalPlugin(filePath: string): Promise<PluginManifest[]> {
  return invokeApi('plugin_action', { request: { action: 'install', filePath } });
}

export function uninstallPlugin(id: string): Promise<PluginManifest[]> {
  return invokeApi('plugin_action', { request: { action: 'uninstall', id } });
}

export function setPluginEnabled(id: string, enabled: boolean): Promise<PluginManifest[]> {
  return invokeApi('plugin_action', { request: { action: 'enabled', id, enabled } });
}

export function reorderPlugins(ids: string[]): Promise<PluginManifest[]> {
  return invokeApi('plugin_action', { request: { action: 'reorder', ids } });
}
