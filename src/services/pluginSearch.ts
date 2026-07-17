import { invoke } from '@tauri-apps/api/core';
import type { PluginManifest, PluginPlaybackQualities, PluginPlaybackQuality, PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
import { isTauriRuntime } from './music';
import { listInstalledPlugins } from './plugins';

interface PluginMusicItem {
  id?: string | number;
  songmid?: string;
  mid?: string;
  albummid?: string;
  albumid?: string | number;
  title?: string;
  name?: string;
  artist?: string;
  artists?: string[] | { name?: string }[];
  album?: string;
  albumId?: string | number;
  artwork?: string;
  year?: number | string;
  releaseYear?: number | string;
  publishYear?: number | string;
  publish_time?: number | string;
  releaseDate?: number | string;
  release_date?: number | string;
  date?: number | string;
  genre?: string;
  style?: string;
  trackNumber?: number | string;
  trackNo?: number | string;
  track_no?: number | string;
  index?: number | string;
  rawLrc?: string;
  rawLrcTxt?: string;
  lyric?: string;
  lyrics?: string;
  lrc?: string;
  duration?: number | string;
  duration_ms?: number | string;
  interval?: number | string;
  interval_ms?: number | string;
  time?: number | string;
  songTime?: number | string;
  song_time?: number | string;
  play_time?: number | string;
  durationText?: number | string;
  duration_text?: number | string;
  album_id?: string | number;
  album_audio_id?: string | number;
  '320hash'?: string;
  sqhash?: string;
  ResFileHash?: string;
  origin_hash?: string;
  raw?: PluginMusicItem;
  rawData?: PluginMusicItem;
  musicData?: PluginMusicItem;
  artistId?: string | number;
  formats?: string;
}

interface WasmPluginErrorResponse {
  error?: string;
}

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

export async function getPluginPlaybackSource(
  track: PluginSearchTrack,
  quality: PluginPlaybackQuality,
  options: PluginPlaybackRequestOptions = {},
): Promise<PluginPlaybackSource> {
  const plugins = await listInstalledPlugins();
  const plugin = plugins.find((item) => item.id === track.providerId);
  if (!plugin) throw new Error('Plugin for selected track is not installed.');

  return playWithWasmPlugin(plugin, track, quality, options);
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
  return searchWithWasmPlugin(plugin, keyword, page, pageSize);
}

async function searchWithWasmPlugin(plugin: PluginManifest, keyword: string, page: number, pageSize: number): Promise<PluginSearchPage> {
  const response = await invokeWasmPlugin(plugin, { action: 'search', keyword, page, pageSize });
  return normalizeWasmSearchPage(plugin, response);
}

async function playWithWasmPlugin(
  plugin: PluginManifest,
  track: PluginSearchTrack,
  quality: PluginPlaybackQuality,
  options: PluginPlaybackRequestOptions,
): Promise<PluginPlaybackSource> {
  const response = await invokeWasmPlugin(plugin, {
    action: 'play',
    track: track.raw ?? track,
    quality,
    includeMetadata: options.includeMetadata !== false,
  });
  return response as PluginPlaybackSource;
}

async function invokeWasmPlugin(plugin: PluginManifest, request: Record<string, unknown>): Promise<unknown> {
  if (!isTauriRuntime()) throw new Error('Plugin execution is only available in the desktop runtime.');

  const response = await invoke('plugin_invoke', {
    entry: plugin.entry,
    request,
    pluginId: plugin.id,
    permissions: plugin.permissions,
  });
  const pluginError = response as WasmPluginErrorResponse;
  if (pluginError?.error) {
    throw new Error(pluginError.error);
  }

  return response;
}

function normalizeWasmSearchPage(plugin: PluginManifest, response: unknown): PluginSearchPage {
  const page = response as Partial<PluginSearchPage> | null;
  const rawTracks = Array.isArray(page?.tracks) ? page.tracks : [];
  const tracks = rawTracks.map((track) => normalizeWasmSearchTrack(plugin, track));

  return {
    tracks,
    isEnd: typeof page?.isEnd === 'boolean' ? page.isEnd : tracks.length === 0,
  };
}

function normalizeWasmSearchTrack(plugin: PluginManifest, rawTrack: unknown): PluginSearchTrack {
  const track = rawTrack as Partial<PluginSearchTrack> & PluginMusicItem;
  const id = track.id === undefined || track.id === null
    ? `${plugin.id}:${track.title ?? track.name ?? crypto.randomUUID()}`
    : String(track.id);

  return {
    id,
    providerId: plugin.id,
    providerName: plugin.name,
    title: track.title ?? track.name ?? 'Unknown Track',
    artist: track.artist ?? normalizeArtist(track),
    album: track.album ?? '',
    duration: typeof track.duration === 'number' ? track.duration : normalizeDuration(track),
    artwork: track.artwork ?? null,
    year: normalizeYear(track),
    genre: normalizeGenre(track),
    trackNumber: normalizeTrackNumber(track),
    raw: track.raw ?? rawTrack,
  };
}

function normalizeArtist(item: PluginMusicItem) {
  if (item.artist) return item.artist;
  if (!item.artists?.length) return 'Unknown Artist';

  return item.artists
    .map((artist) => typeof artist === 'string' ? artist : artist.name)
    .filter(Boolean)
    .join(', ') || 'Unknown Artist';
}

function normalizeDuration(item: PluginMusicItem) {
  const rawItem = item.raw ?? item.rawData ?? item.musicData;
  const duration = [
    item.duration,
    item.interval,
    item.time,
    item.songTime,
    item.song_time,
    item.play_time,
    item.durationText,
    item.duration_text,
    rawItem?.duration,
    rawItem?.interval,
    rawItem?.time,
    rawItem?.songTime,
    rawItem?.song_time,
    rawItem?.play_time,
    rawItem?.durationText,
    rawItem?.duration_text,
  ].map(parseDurationValue).find((value): value is number => value !== null);

  if (duration !== undefined) {
    return duration;
  }

  const durationMs = [item.duration_ms, item.interval_ms, rawItem?.duration_ms, rawItem?.interval_ms]
    .map(parseNumericDuration)
    .find((value): value is number => value !== null);

  if (durationMs !== undefined) {
    return Math.round(durationMs / 1000);
  }

  const nestedDuration = findNestedDuration(item);
  if (nestedDuration !== null) {
    return nestedDuration;
  }

  return null;
}

function normalizeYear(item: PluginMusicItem) {
  const rawItem = item.raw ?? item.rawData ?? item.musicData;
  return [
    item.year,
    item.releaseYear,
    item.publishYear,
    item.publish_time,
    item.releaseDate,
    item.release_date,
    item.date,
    rawItem?.year,
    rawItem?.releaseYear,
    rawItem?.publishYear,
    rawItem?.publish_time,
    rawItem?.releaseDate,
    rawItem?.release_date,
    rawItem?.date,
  ].map(parseYearValue).find((value): value is number => value !== null) ?? null;
}

function normalizeGenre(item: PluginMusicItem) {
  const rawItem = item.raw ?? item.rawData ?? item.musicData;
  return [
    item.genre,
    item.style,
    rawItem?.genre,
    rawItem?.style,
  ].map(parseStringValue).find((value): value is string => value !== null) ?? null;
}

function normalizeTrackNumber(item: PluginMusicItem) {
  const rawItem = item.raw ?? item.rawData ?? item.musicData;
  return [
    item.trackNumber,
    item.trackNo,
    item.track_no,
    item.index,
    rawItem?.trackNumber,
    rawItem?.trackNo,
    rawItem?.track_no,
    rawItem?.index,
  ].map(parsePositiveInteger).find((value): value is number => value !== null) ?? null;
}

function parseStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseYearValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const year = Math.trunc(value);
    return year >= 1000 && year <= 9999 ? year : null;
  }

  if (typeof value !== 'string') return null;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parsePositiveInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const number = Math.trunc(value);
    return number > 0 ? number : null;
  }

  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return number > 0 ? number : null;
}

function parseDurationValue(value: number | string | undefined) {
  const seconds = parseNumericDuration(value);
  if (seconds !== null) {
    return seconds > 1000 ? Math.round(seconds / 1000) : seconds;
  }

  if (typeof value !== 'string') return null;
  const timeParts = value.trim().match(/^(\d{1,2}:)?\d{1,2}:\d{1,2}$/);
  if (!timeParts) return null;

  return value
    .split(':')
    .map((part) => Number.parseInt(part, 10))
    .reduce((total, part) => total * 60 + part, 0);
}

function parseNumericDuration(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const duration = Number.parseFloat(normalized);
  return Number.isFinite(duration) ? Math.round(duration) : null;
}

function findNestedDuration(value: unknown, depth = 0): number | null {
  if (!value || typeof value !== 'object' || depth > 4) return null;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isDurationKey(key)) {
      const duration = key.endsWith('_ms')
        ? parseNumericDuration(item as number | string | undefined)
        : parseDurationValue(item as number | string | undefined);
      if (duration !== null) {
        return key.endsWith('_ms') ? Math.round(duration / 1000) : duration;
      }
    }
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    const duration = findNestedDuration(item, depth + 1);
    if (duration !== null) return duration;
  }

  return null;
}

function isDurationKey(key: string) {
  return [
    'duration',
    'duration_ms',
    'durationText',
    'duration_text',
    'interval',
    'interval_ms',
    'play_time',
    'songTime',
    'song_time',
    'time',
  ].includes(key);
}

