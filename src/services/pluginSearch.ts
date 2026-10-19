import type { PluginManifest, PluginPlaybackQualities, PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
import type { TrackLyrics } from '../types/music';
import { invokeApi } from './api';
import { isTauriRuntime } from './music';
import { getInstalledPlugin, listInstalledPluginManifests } from './plugins';

export type PluginLyricsMetadata = TrackLyrics;

export interface PluginSearchPage {
  tracks: PluginSearchTrack[];
  isEnd: boolean;
}

export async function listPluginSearchProviders(): Promise<PluginSearchProvider[]> {
  const plugins = await listInstalledPluginManifests('music-search');
  return plugins
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      runtime: plugin.runtime,
      enabled: plugin.enabled,
    }));
}

export async function listPluginLyricSearchProviders(): Promise<PluginSearchProvider[]> {
  const plugins = await listInstalledPluginManifests('lyrics-search');
  return plugins
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      runtime: plugin.runtime,
      enabled: plugin.enabled,
    }));
}

export interface OnlineMusicSearchResult extends PluginSearchPage {
  sessionId: string;
}

export function searchPluginMusic(keyword: string, providerId: string, sessionId: string | null = null): Promise<OnlineMusicSearchResult> {
  if (!isTauriRuntime()) throw new Error('在线搜索仅支持桌面环境。');
  return invokeApi<OnlineMusicSearchResult>('search_online_music', { keyword, providerId, sessionId });
}

export function searchPluginLyrics(keyword: string, providerId: string, sessionId: string | null = null): Promise<OnlineMusicSearchResult> {
  if (!isTauriRuntime()) throw new Error('歌词搜索仅支持桌面环境。');
  return invokeApi<OnlineMusicSearchResult>('search_online_lyrics', { keyword, providerId, sessionId });
}

export interface PluginLyricsPlaybackGuard {
  providerId: string;
  sourceId: string;
}

export async function getPluginLyricsMetadata(track: PluginSearchTrack, playbackGuard?: PluginLyricsPlaybackGuard): Promise<PluginLyricsMetadata> {
  if (!isTauriRuntime()) throw new Error('Plugin lyrics are only available in the desktop runtime.');
  const plugin = await requireInstalledPlugin(track.providerId);

  return invokeApi<PluginLyricsMetadata>('resolve_plugin_lyrics_metadata', {
    providerId: track.providerId,
    track,
    plugins: [plugin],
    playbackGuard,
  });
}

export async function resolvePluginPlaybackQualitiesWithRust(track: PluginSearchTrack): Promise<PluginPlaybackQualities> {
  if (!isTauriRuntime()) throw new Error('Plugin playback is only available in the desktop runtime.');
  const plugin = await requireInstalledPlugin(track.providerId);

  return invokeApi<PluginPlaybackQualities>('resolve_plugin_playback_qualities', {
    providerId: track.providerId,
    track,
    plugins: [plugin],
  });
}

async function requireInstalledPlugin(pluginId: string): Promise<PluginManifest> {
  const plugin = await getInstalledPlugin(pluginId);
  if (!plugin) throw new Error('Selected plugin is not installed.');
  return plugin;
}

export async function searchPluginCoverCandidates(keyword: string, providerId: string | null): Promise<PluginSearchPage> {
  if (!providerId) throw new Error('请选择搜索来源。');
  if (!keyword.trim()) return { tracks: [], isEnd: true };
  const plugin = await requireInstalledPlugin(providerId);
  return invokeApi<PluginSearchPage>('search_plugin', {
    providerId, keyword: keyword.trim(), page: 1, pageSize: 30, plugins: [plugin],
  });
}
