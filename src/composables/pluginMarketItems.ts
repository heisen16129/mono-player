import type { PluginCatalogItem, PluginManifest } from '../types/plugin';
import type { PluginMarketItem, PluginMarketKind, PluginMarketStatus } from './usePluginMarket';

const OFFICIAL_PLUGIN_ENTRY_PREFIX = 'https://raw.githubusercontent.com/heisen16129/mono-plugin-store/';
const MARKET_PLUGIN_KINDS = new Set<string>(['music', 'lyrics', 'lyrics-renderer', 'metadata', 'playlist', 'theme', 'integration', 'tool']);

export function isMarketPluginKind(kind: string): kind is PluginMarketKind {
  return MARKET_PLUGIN_KINDS.has(kind);
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

export function toRealMarketPlugin(catalogItem: PluginCatalogItem | null, manifest: PluginManifest | null): PluginMarketItem | null {
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
