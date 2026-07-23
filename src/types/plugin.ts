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
  | 'lyrics'
  | 'metadata'
  | 'cover'
  | 'album'
  | 'playlist-import'
  | 'playlist-export'
  | 'theme'
  | 'scrobble'
  | 'history-sync'
  | 'batch-rename'
  | 'lyric-convert'
  | 'lyric-translate';

export type PluginKind = 'music' | 'lyrics' | 'metadata' | 'playlist' | 'theme' | 'integration' | 'tool';

export type PluginSourceKind = 'official' | 'subscription' | 'local';

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
  author: string;
  description: string;
  icon?: string;
  updatedAt: string;
  capabilities: PluginCapability[];
  tags?: string[];
  highlights?: string[];
  screenshots?: string[];
  permissions: PluginPermission[];
  sourceUrl?: string;
  sourceKind: PluginSourceKind;
  installedAt: string;
  enabled: boolean;
}

export interface PluginThemePayload {
  id?: string;
  name?: string;
  author?: string;
  variables: Record<string, string>;
  preview?: string | null;
  background?: string | null;
  backgroundOpacity?: number | null;
}

export interface PluginCatalogItem {
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  runtime: PluginRuntime;
  entry: string;
  author: string;
  description: string;
  icon?: string;
  updatedAt: string;
  capabilities: PluginCapability[];
  tags?: string[];
  highlights?: string[];
  screenshots?: string[];
  permissions: PluginPermission[];
  sourceUrl: string;
  sourceKind: PluginSourceKind;
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
