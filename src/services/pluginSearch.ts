import { invoke } from '@tauri-apps/api/core';
import type { PluginManifest, PluginPlaybackQualities, PluginPlaybackQuality, PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
import { isTauriRuntime } from './music';
import { listInstalledPlugins } from './plugins';

export interface PluginPlaybackSource {
  url: string;
  path?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number | null;
  artwork?: string | null;
  lyrics?: PluginLyricsMetadata | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  quality?: PluginPlaybackQuality;
  sourceId?: string;
  sourceName?: string;
  sourceProviderId?: string;
  sourceRaw?: unknown;
}

export interface PluginLyricsMetadata {
  rawLyrics?: string | null;
  lyricsUrl?: string | null;
  formats?: string[];
  defaultFormat?: 'lrc' | 'trans' | 'yrc' | 'qrc' | 'krc' | 'a2' | string | null;
  format?: 'lrc' | 'trans' | 'yrc' | 'qrc' | 'krc' | 'a2' | string | null;
}

interface PluginPlaybackRequestOptions {
  includeMetadata?: boolean;
}

export interface PluginSearchPage {
  tracks: PluginSearchTrack[];
  isEnd: boolean;
}

export async function listPluginSearchProviders(): Promise<PluginSearchProvider[]> {
  const plugins = await listInstalledPlugins();
  return plugins
    .filter((plugin) => plugin.capabilities.includes('search') && plugin.capabilities.includes('play'))
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      runtime: plugin.runtime,
      enabled: plugin.enabled,
    }));
}

export async function listPluginLyricSearchProviders(): Promise<PluginSearchProvider[]> {
  const plugins = await listInstalledPlugins();
  return plugins
    .filter((plugin) => plugin.capabilities.includes('search') && plugin.capabilities.includes('lyrics'))
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      runtime: plugin.runtime,
      enabled: plugin.enabled,
    }));
}

export async function searchPluginMusic(keyword: string, providerId?: string | null, page = 1, pageSize = 30): Promise<PluginSearchPage> {
  const query = keyword.trim();
  if (!query) return { tracks: [], isEnd: true };

  const plugins = await listInstalledPlugins();
  const candidateProviders = plugins.filter((plugin) => {
    return plugin.enabled
      && plugin.capabilities.includes('search')
      && plugin.capabilities.includes('play')
      && (!providerId || plugin.id === providerId);
  });

  if (candidateProviders.length === 0) {
    throw new Error(providerId ? 'Selected plugin is not enabled or does not support search.' : 'No enabled plugin supports music search. Install and enable a plugin first.');
  }

  if (providerId && candidateProviders.length === 1) {
    return searchWithPlugin(candidateProviders[0], query, page, pageSize);
  }

  const settledResults = await Promise.allSettled(
    candidateProviders.map((plugin) => searchWithPluginPage(plugin, query, page, pageSize)),
  );
  const pages = settledResults
    .filter((result): result is PromiseFulfilledResult<PluginSearchPage> => result.status === 'fulfilled')
    .map((result) => result.value);
  const tracks = pages.flatMap((result) => result.tracks);

  if (tracks.length > 0) {
    return {
      tracks,
      isEnd: pages.every((result) => result.isEnd || result.tracks.length < pageSize),
    };
  }

  const firstError = settledResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (firstError) {
    throw new Error(firstError.reason instanceof Error ? firstError.reason.message : 'Plugin search failed.');
  }

  return { tracks: [], isEnd: true };
}

export async function searchPluginLyrics(keyword: string, providerId?: string | null, page = 1, pageSize = 30): Promise<PluginSearchPage> {
  const query = keyword.trim();
  if (!query) return { tracks: [], isEnd: true };

  const plugins = await listInstalledPlugins();
  const candidateProviders = plugins.filter((plugin) => {
    return plugin.enabled
      && plugin.capabilities.includes('search')
      && plugin.capabilities.includes('lyrics')
      && (!providerId || plugin.id === providerId);
  });

  if (candidateProviders.length === 0) {
    throw new Error(providerId ? '选中的插件未启用，或不支持搜索歌词。' : '没有启用支持搜索歌词的插件。');
  }

  if (providerId && candidateProviders.length === 1) {
    return searchWithPlugin(candidateProviders[0], query, page, pageSize);
  }

  const settledResults = await Promise.allSettled(
    candidateProviders.map((plugin) => searchWithPluginPage(plugin, query, page, pageSize)),
  );
  const pages = settledResults
    .filter((result): result is PromiseFulfilledResult<PluginSearchPage> => result.status === 'fulfilled')
    .map((result) => result.value);
  const tracks = pages.flatMap((result) => result.tracks);

  if (tracks.length > 0) {
    return {
      tracks,
      isEnd: pages.every((result) => result.isEnd || result.tracks.length < pageSize),
    };
  }

  const firstError = settledResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (firstError) {
    throw new Error(firstError.reason instanceof Error ? firstError.reason.message : '歌词插件搜索失败。');
  }

  return { tracks: [], isEnd: true };
}

export async function getPluginLyricsMetadata(track: PluginSearchTrack, format?: string | null): Promise<PluginLyricsMetadata> {
  const plugins = await listInstalledPlugins();
  if (!isTauriRuntime()) throw new Error('Plugin lyrics are only available in the desktop runtime.');

  return invoke<PluginLyricsMetadata>('resolve_plugin_lyrics_metadata', {
    providerId: track.providerId,
    track,
    format: format?.trim() || null,
    plugins,
  });
}

export async function resolvePluginPlaybackSourceWithRust(
  track: PluginSearchTrack,
  preferredQuality: PluginPlaybackQuality | null,
  qualityFallback: string,
  options: PluginPlaybackRequestOptions = {},
): Promise<PluginPlaybackSource> {
  const plugins = await listInstalledPlugins();
  if (!isTauriRuntime()) throw new Error('Plugin playback is only available in the desktop runtime.');

  return invoke<PluginPlaybackSource>('resolve_plugin_playback_source', {
    providerId: track.providerId,
    track,
    preferredQuality: preferredQuality?.trim() || null,
    qualityFallback,
    includeMetadata: options.includeMetadata !== false,
    plugins,
  });
}

export async function resolvePluginPlaybackQualitiesWithRust(track: PluginSearchTrack): Promise<PluginPlaybackQualities> {
  const plugins = await listInstalledPlugins();
  if (!isTauriRuntime()) throw new Error('Plugin playback is only available in the desktop runtime.');

  return invoke<PluginPlaybackQualities>('resolve_plugin_playback_qualities', {
    providerId: track.providerId,
    track,
    plugins,
  });
}

async function searchWithPluginPage(plugin: PluginManifest, keyword: string, page: number, pageSize: number): Promise<PluginSearchPage> {
  const collected: PluginSearchTrack[] = [];
  let isEnd = false;
  let pluginPage = 1;
  const offset = Math.max(0, page - 1) * pageSize;
  const targetCount = offset + pageSize;

  while (collected.length < targetCount && !isEnd && pluginPage <= page * 3 + 3) {
    const result = await searchWithPlugin(plugin, keyword, pluginPage, pageSize);
    collected.push(...result.tracks);
    isEnd = result.isEnd || result.tracks.length === 0;
    pluginPage += 1;
  }

  const tracks = collected.slice(offset, targetCount);
  const reachedRequestedPage = collected.length >= targetCount;
  return {
    tracks,
    isEnd: isEnd || !reachedRequestedPage || tracks.length < pageSize,
  };
}

async function searchWithPlugin(plugin: PluginManifest, keyword: string, page: number, pageSize: number): Promise<PluginSearchPage> {
  if (!isTauriRuntime()) throw new Error('Plugin search is only available in the desktop runtime.');

  const plugins = await listInstalledPlugins();
  return invoke<PluginSearchPage>('search_plugin', {
    providerId: plugin.id,
    keyword,
    page,
    pageSize,
    plugins,
  });
}
