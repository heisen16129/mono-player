import type { PluginCapability, PluginCatalogItem, PluginManifest, PluginRuntime } from '../../types/plugin';

export interface PluginRow {
  id: string;
  name: string;
  version: string;
  latestVersion: string;
  author: string;
  runtime: PluginRuntime;
  capabilities: PluginCapability[];
  installed: boolean;
  enabled: boolean;
  catalogItem: PluginCatalogItem | null;
  manifest: PluginManifest | null;
}
