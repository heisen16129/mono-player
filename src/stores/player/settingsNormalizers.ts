import { resolveLocale } from '../../i18n';
import type { AppTheme, PlayerSettings, UserPlaylist } from '../../types/music';
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
import { normalizeFavoriteTracks } from './favoriteNormalizers';
import { normalizeLocalPathInput } from './pathNormalizers';
import { isBuiltInTheme } from './themeNormalizers';

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
          name: playlist.name.trim() || (resolveLocale(parsed.locale) === 'en-US' ? 'Untitled playlist' : '\u672a\u547d\u540d\u6b4c\u5355'),
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
      rawTheme === 'wallpaperTone'
        ? 'blueWhite'
        : rawTheme === 'windowsTone'
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
