import { resolveLocale } from '../../i18n';
import type { AppTheme, CustomTheme, PlaybackMode, PlaybackSession, PlayerSettings, SystemThemeState, Track, UserPlaylist } from '../../types/music';
import { normalizeTrackLyrics } from '../../utils/trackLyrics';
import {
  fallbackSettings,
  MAX_AUDIO_CACHE_MAX_MB,
  MAX_LYRIC_FONT_SIZE,
  MAX_SEARCH_HISTORY_LIMIT,
  MAX_SLEEP_TIMER_MINUTES,
  MIN_AUDIO_CACHE_MAX_MB,
  MIN_LYRIC_FONT_SIZE,
  MIN_SEARCH_HISTORY_LIMIT,
  MIN_SLEEP_TIMER_MINUTES,
  ONLINE_PLAYBACK_FAILURE_ACTIONS,
  QUALITY_FALLBACKS,
} from './constants';

export interface CachedSystemThemeState {
  state: SystemThemeState;
  savedAt: number;
}

export function normalizeSettings(value: unknown): PlayerSettings {
  try {
    const parsed = { ...fallbackSettings, ...(value && typeof value === 'object' ? value : {}) } as PlayerSettings;
    const dirs = Array.isArray(parsed.musicDirs)
      ? parsed.musicDirs.filter((dir): dir is string => typeof dir === 'string' && dir.trim().length > 0)
      : [];
    if (parsed.musicDir.trim() && !dirs.includes(parsed.musicDir)) {
      dirs.unshift(parsed.musicDir);
    }
    const lastAddedTrackIds = Array.isArray(parsed.lastAddedTrackIds)
      ? parsed.lastAddedTrackIds.filter((id): id is number => typeof id === 'number')
      : [];
    const recentPlayedTrackIds = Array.isArray(parsed.recentPlayedTrackIds)
      ? parsed.recentPlayedTrackIds.filter((id): id is number => typeof id === 'number')
      : [];
    const playlists = Array.isArray(parsed.playlists)
      ? parsed.playlists.filter((playlist): playlist is UserPlaylist => {
          return (
            typeof playlist?.id === 'string' &&
            typeof playlist.name === 'string' &&
            Array.isArray(playlist.trackIds) &&
            typeof playlist.createdAt === 'number'
          );
        }).map((playlist) => ({
          ...playlist,
          name: playlist.name.trim() || (resolveLocale(parsed.locale) === 'en-US' ? 'Untitled playlist' : '未命名歌单'),
          trackIds: playlist.trackIds.filter((id): id is number => typeof id === 'number'),
          tracks: normalizeFavoriteTracks((playlist as { tracks?: unknown }).tracks),
        }))
      : [];
    const closeAction = parsed.closeAction === 'tray' ? 'tray' : 'exit';
    const locale = parsed.locale === 'zh-CN' || parsed.locale === 'en-US' ? parsed.locale : 'system';
    const sleepTimerAction = parsed.sleepTimerAction === 'exit' || parsed.sleepTimerAction === 'finishTrack'
      ? parsed.sleepTimerAction
      : 'stop';
    const rawSleepTimerMinutes = Number(parsed.sleepTimerMinutes);
    const sleepTimerMinutes = Number.isFinite(rawSleepTimerMinutes)
      ? Math.min(MAX_SLEEP_TIMER_MINUTES, Math.max(MIN_SLEEP_TIMER_MINUTES, Math.round(rawSleepTimerMinutes)))
      : fallbackSettings.sleepTimerMinutes;
    const rawLyricFontSize = Number(parsed.lyricFontSize);
    const lyricFontSize = Number.isFinite(rawLyricFontSize)
      ? Math.min(MAX_LYRIC_FONT_SIZE, Math.max(MIN_LYRIC_FONT_SIZE, Math.round(rawLyricFontSize)))
      : fallbackSettings.lyricFontSize;
    const lyricFontColor = typeof parsed.lyricFontColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.lyricFontColor)
      ? parsed.lyricFontColor
      : fallbackSettings.lyricFontColor;
    const downloadDir = typeof parsed.downloadDir === 'string' ? parsed.downloadDir : fallbackSettings.downloadDir;
    const audioCacheDir = typeof parsed.audioCacheDir === 'string' ? normalizeLocalPathInput(parsed.audioCacheDir) : fallbackSettings.audioCacheDir;
    const rawAudioCacheMaxMb = Number((parsed as { audioCacheMaxMb?: unknown }).audioCacheMaxMb);
    const audioCacheMaxMb = Number.isFinite(rawAudioCacheMaxMb)
      ? Math.min(MAX_AUDIO_CACHE_MAX_MB, Math.max(MIN_AUDIO_CACHE_MAX_MB, Math.round(rawAudioCacheMaxMb)))
      : fallbackSettings.audioCacheMaxMb;
    const audioOutputDeviceId = typeof parsed.audioOutputDeviceId === 'string' ? parsed.audioOutputDeviceId : fallbackSettings.audioOutputDeviceId;
    const rawSearchHistoryLimit = Number((parsed as { searchHistoryLimit?: unknown }).searchHistoryLimit);
    const searchHistoryLimit = Number.isFinite(rawSearchHistoryLimit)
      ? Math.min(MAX_SEARCH_HISTORY_LIMIT, Math.max(MIN_SEARCH_HISTORY_LIMIT, Math.round(rawSearchHistoryLimit)))
      : fallbackSettings.searchHistoryLimit;
    const useThemeLyricColor = parsed.useThemeLyricColor !== false;
    const rawTheme = String((parsed as { theme?: unknown }).theme ?? '');
    const theme: AppTheme =
      rawTheme === 'windowsTone'
        ? 'desktopGlass'
        : isBuiltInTheme(rawTheme) || rawTheme.startsWith('custom:')
          ? rawTheme as AppTheme
          : fallbackSettings.theme;
    const autoHideLyricsDock = parsed.autoHideLyricsDock === true;
    const showTrackNumbers = parsed.showTrackNumbers !== false;
    const showTrackCovers = parsed.showTrackCovers !== false;
    const enableLocalMetadataEditing = parsed.enableLocalMetadataEditing === true;
    const enableTrackMetadataEdit = parsed.enableTrackMetadataEdit === true;
    const enableTrackCoverEdit = parsed.enableTrackCoverEdit === true;
    const enableTrackDurationRefresh = parsed.enableTrackDurationRefresh === true;
    const enablePlugins = parsed.enablePlugins === true;
    const qualityFallback = QUALITY_FALLBACKS.includes(parsed.qualityFallback)
      ? parsed.qualityFallback
      : fallbackSettings.qualityFallback;
    const onlinePlaybackFailureAction = ONLINE_PLAYBACK_FAILURE_ACTIONS.includes(parsed.onlinePlaybackFailureAction)
      ? parsed.onlinePlaybackFailureAction
      : fallbackSettings.onlinePlaybackFailureAction;
    const seamlessPlayback = parsed.seamlessPlayback !== false;
    const fadePlayback = parsed.fadePlayback === true;
    const crossfadePlayback = parsed.crossfadePlayback === true;
    const mcpAutoStart = parsed.mcpAutoStart !== false;
    return { ...parsed, musicDirs: dirs, lastAddedTrackIds, recentPlayedTrackIds, playlists, closeAction, locale, sleepTimerAction, sleepTimerMinutes, theme, autoHideLyricsDock, lyricFontSize, useThemeLyricColor, lyricFontColor, downloadDir, audioCacheDir, audioCacheMaxMb, audioOutputDeviceId, searchHistoryLimit, showTrackNumbers, showTrackCovers, enableLocalMetadataEditing, enableTrackMetadataEdit, enableTrackCoverEdit, enableTrackDurationRefresh, enablePlugins, qualityFallback, onlinePlaybackFailureAction, seamlessPlayback, fadePlayback, crossfadePlayback, mcpAutoStart };
  } catch {
    return fallbackSettings;
  }
}

export function normalizeTrackPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/\/\?\//, '').toLocaleLowerCase();
}

export function normalizeLocalPathInput(path: string) {
  const trimmed = path.trim();
  if (!trimmed.toLocaleLowerCase().startsWith('file:///')) return trimmed;

  try {
    return decodeURIComponent(trimmed)
      .replace(/^file:\/\/\//i, '')
      .replace(/\//g, '\\');
  } catch {
    return trimmed.replace(/^file:\/\/\//i, '').replace(/\//g, '\\');
  }
}

export function dedupeTracksByPath(items: Track[]) {
  const seenPaths = new Set<string>();
  return items.filter((track) => {
    const path = normalizeTrackPath(track.path);
    if (!path || seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  });
}

export function normalizeFavoriteTrackIds(value: unknown): number[] {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  return [...new Set(ids)];
}

export function normalizeTrackSnapshot(value: unknown): Track | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<Track>;
  if (typeof parsed.id !== 'number' || typeof parsed.path !== 'string' || typeof parsed.title !== 'string') {
    return null;
  }

  return {
    id: parsed.id,
    path: parsed.path,
    title: parsed.title,
    artist: typeof parsed.artist === 'string' ? parsed.artist : null,
    album: typeof parsed.album === 'string' ? parsed.album : null,
    duration: typeof parsed.duration === 'number' ? parsed.duration : null,
    artwork: typeof parsed.artwork === 'string' ? parsed.artwork : null,
    associatedArtwork: typeof parsed.associatedArtwork === 'string' ? parsed.associatedArtwork : null,
    lyrics: parsed.lyrics ? normalizeTrackLyrics({ ...(parsed as Track), associatedLyrics: null }) : null,
    associatedLyrics: parsed.associatedLyrics ? normalizeTrackLyrics({ ...(parsed as Track), lyrics: null }) : null,
    sourceId: typeof parsed.sourceId === 'string' ? parsed.sourceId : null,
    sourceName: typeof parsed.sourceName === 'string' ? parsed.sourceName : null,
    sourceProviderId: typeof parsed.sourceProviderId === 'string' ? parsed.sourceProviderId : null,
    sourceRaw: parsed.sourceRaw,
  };
}

export function normalizeFavoriteTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];
  const tracks = value
    .map((track) => normalizeTrackSnapshot(track))
    .filter((track): track is Track => Boolean(track));
  const trackById = new Map<number, Track>();
  for (const track of tracks) {
    trackById.set(track.id, track);
  }
  return [...trackById.values()];
}

export function normalizeFavoriteStore(value: unknown): { ids: number[]; tracks: Track[] } {
  if (Array.isArray(value)) {
    return { ids: normalizeFavoriteTrackIds(value), tracks: [] };
  }

  if (!value || typeof value !== 'object') {
    return { ids: [], tracks: [] };
  }

  const parsed = value as { ids?: unknown; tracks?: unknown };
  return {
    ids: normalizeFavoriteTrackIds(parsed.ids),
    tracks: normalizeFavoriteTracks(parsed.tracks),
  };
}

export function normalizeCustomThemes(value: unknown): CustomTheme[] {
  return Array.isArray(value)
    ? value.filter((theme): theme is CustomTheme => {
        return (
          typeof theme?.id === 'string' &&
          theme.id.startsWith('custom:') &&
          typeof theme.name === 'string' &&
          typeof theme.author === 'string' &&
          theme.variables &&
          typeof theme.variables === 'object'
        );
      })
    : [];
}

export function normalizePlaybackSession(value: unknown): PlaybackSession | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const parsed = value as Partial<PlaybackSession>;
    const playbackMode: PlaybackMode =
      parsed.playbackMode === 'repeat' || parsed.playbackMode === 'fixed' ? parsed.playbackMode : 'shuffle';
    const currentTime = Number(parsed.currentTime);
    const currentTrack = normalizeTrackSnapshot(parsed.currentTrack);
    const queueTracks = dedupeTracksByPath(Array.isArray(parsed.queueTracks)
      ? parsed.queueTracks
        .map((track) => normalizeTrackSnapshot(track))
        .filter((track): track is Track => Boolean(track?.path))
      : []);

    if (currentTrack?.path && !queueTracks.some((track) => track.path === currentTrack.path)) {
      queueTracks.unshift(currentTrack);
    }

    if (!currentTrack && queueTracks.length === 0) return null;

    return {
      currentTrack,
      queueTracks,
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      playbackMode,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function isBuiltInTheme(theme: string): theme is Exclude<AppTheme, `custom:${string}`> {
  return theme === 'dark' || theme === 'light' || theme === 'blueWhite' || theme === 'wallpaperTone' || theme === 'desktopGlass';
}

export function isCustomTheme(theme: AppTheme): theme is `custom:${string}` {
  return theme.startsWith('custom:');
}

export function normalizeCachedSystemThemeState(value: unknown): CachedSystemThemeState | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const parsed = value as CachedSystemThemeState;
    if (
      typeof parsed.savedAt !== 'number' ||
      (parsed.state?.mode !== 'light' && parsed.state?.mode !== 'dark') ||
      typeof parsed.state.appsUseLightTheme !== 'boolean' ||
      typeof parsed.state.systemUsesLightTheme !== 'boolean'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
