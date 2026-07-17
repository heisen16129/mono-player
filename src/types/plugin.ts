export type PluginRuntime = 'wasm';

export type PluginPlaybackQuality = string;

export interface PluginPlaybackQualityOption {
  id: PluginPlaybackQuality;
  name: string;
  available: boolean;
  reason?: string | null;
}

export interface PluginPlaybackQualities {
  qualities: PluginPlaybackQualityOption[];
  defaultQuality?: PluginPlaybackQuality | null;
}

export type PluginCapability =
  | 'search'
  | 'play'
  | 'lyrics';

export type PluginKind = 'music' | 'lyrics';

export type PluginPermission =
  | 'network'
  | 'credential-read'
  | 'cache-read'
  | 'cache-write'
  | 'download-write';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  runtime: PluginRuntime;
  entry: string;
  author?: string;
  description?: string;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  sourceUrl?: string;
  installedAt: string;
  enabled: boolean;
}

export interface PluginCatalogItem {
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  runtime: PluginRuntime;
  entry: string;
  author?: string;
  description?: string;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  sourceUrl: string;
}

export interface PluginSubscription {
  id: string;
  name: string;
  url: string;
  updatedAt?: string;
}

export interface PluginSearchTrack {
  id: string;
  providerId: string;
  providerName: string;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  artwork?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  raw?: unknown;
}

export interface PluginSearchProvider {
  id: string;
  name: string;
  runtime: PluginRuntime;
  enabled: boolean;
}
