import type { Ref } from 'vue';
import type { Locale, PlayerSettings, ShortcutAction } from '../../types/music';
import {
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
import { normalizeLocalPathInput } from './normalizers';

interface PlayerSettingsActionsOptions {
  persistSettings: () => void;
  settings: Ref<PlayerSettings>;
}

export function createPlayerSettingsActions({ persistSettings, settings }: PlayerSettingsActionsOptions) {
  function setCloseAction(action: PlayerSettings['closeAction']) {
    settings.value.closeAction = action;
    persistSettings();
  }

  function setLocale(locale: Locale) {
    settings.value.locale = locale;
    persistSettings();
  }

  function setSleepTimerAction(action: PlayerSettings['sleepTimerAction']) {
    settings.value.sleepTimerAction = action;
    persistSettings();
  }

  function setSleepTimerMinutes(minutes: number) {
    settings.value.sleepTimerMinutes = Math.min(MAX_SLEEP_TIMER_MINUTES, Math.max(MIN_SLEEP_TIMER_MINUTES, Math.round(minutes)));
    persistSettings();
  }

  function setAutoHideLyricsDock(enabled: boolean) {
    settings.value.autoHideLyricsDock = enabled;
    persistSettings();
  }

  function setLyricFontSize(size: number) {
    settings.value.lyricFontSize = Math.min(MAX_LYRIC_FONT_SIZE, Math.max(MIN_LYRIC_FONT_SIZE, Math.round(size)));
    persistSettings();
  }

  function setUseThemeLyricColor(enabled: boolean) {
    settings.value.useThemeLyricColor = enabled;
    persistSettings();
  }

  function setLyricFontColor(color: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    settings.value.lyricFontColor = color;
    persistSettings();
  }

  function setDownloadDir(path: string) {
    settings.value.downloadDir = path.trim();
    persistSettings();
  }

  function setAudioCacheDir(path: string) {
    settings.value.audioCacheDir = normalizeLocalPathInput(path);
    persistSettings();
  }

  function setAudioCacheMaxMb(sizeMb: number) {
    settings.value.audioCacheMaxMb = Math.min(MAX_AUDIO_CACHE_MAX_MB, Math.max(MIN_AUDIO_CACHE_MAX_MB, Math.round(sizeMb)));
    persistSettings();
  }

  function setAudioOutputDeviceId(deviceId: string) {
    settings.value.audioOutputDeviceId = deviceId.trim();
    persistSettings();
  }

  function setSearchHistoryLimit(limit: number) {
    settings.value.searchHistoryLimit = Math.min(MAX_SEARCH_HISTORY_LIMIT, Math.max(MIN_SEARCH_HISTORY_LIMIT, Math.round(limit)));
    persistSettings();
  }

  function setShowTrackCovers(enabled: boolean) {
    settings.value.showTrackCovers = enabled;
    persistSettings();
  }

  function setShowTrackNumbers(enabled: boolean) {
    settings.value.showTrackNumbers = enabled;
    persistSettings();
  }

  function setEnableLocalMetadataEditing(enabled: boolean) {
    settings.value.enableLocalMetadataEditing = enabled;
    persistSettings();
  }

  function setEnableTrackMetadataEdit(enabled: boolean) {
    settings.value.enableTrackMetadataEdit = enabled;
    persistSettings();
  }

  function setEnableTrackCoverEdit(enabled: boolean) {
    settings.value.enableTrackCoverEdit = enabled;
    persistSettings();
  }

  function setEnableTrackDurationRefresh(enabled: boolean) {
    settings.value.enableTrackDurationRefresh = enabled;
    persistSettings();
  }

  function setEnablePlugins(enabled: boolean) {
    settings.value.enablePlugins = enabled;
    persistSettings();
  }

  function setQualityFallback(fallback: PlayerSettings['qualityFallback']) {
    if (!QUALITY_FALLBACKS.includes(fallback)) return;
    settings.value.qualityFallback = fallback;
    persistSettings();
  }

  function setOnlinePlaybackFailureAction(action: PlayerSettings['onlinePlaybackFailureAction']) {
    if (!ONLINE_PLAYBACK_FAILURE_ACTIONS.includes(action)) return;
    settings.value.onlinePlaybackFailureAction = action;
    persistSettings();
  }

  function setSeamlessPlayback(enabled: boolean) {
    settings.value.seamlessPlayback = enabled;
    persistSettings();
  }

  function setFadePlayback(enabled: boolean) {
    settings.value.fadePlayback = enabled;
    persistSettings();
  }

  function setCrossfadePlayback(enabled: boolean) {
    settings.value.crossfadePlayback = enabled;
    persistSettings();
  }

  function setMcpAutoStart(enabled: boolean) {
    settings.value.mcpAutoStart = enabled;
    persistSettings();
  }

  function setEnableAppShortcuts(enabled: boolean) {
    settings.value.enableAppShortcuts = enabled;
    persistSettings();
  }

  function setAppShortcut(action: ShortcutAction, shortcut: string) {
    settings.value.appShortcuts = { ...settings.value.appShortcuts, [action]: shortcut.trim() };
    persistSettings();
  }

  return {
    setAudioCacheDir,
    setAudioCacheMaxMb,
    setAudioOutputDeviceId,
    setAutoHideLyricsDock,
    setCloseAction,
    setCrossfadePlayback,
    setDownloadDir,
    setAppShortcut,
    setEnableLocalMetadataEditing,
    setEnableAppShortcuts,
    setEnablePlugins,
    setEnableTrackCoverEdit,
    setEnableTrackDurationRefresh,
    setEnableTrackMetadataEdit,
    setFadePlayback,
    setLocale,
    setLyricFontColor,
    setLyricFontSize,
    setMcpAutoStart,
    setOnlinePlaybackFailureAction,
    setQualityFallback,
    setSearchHistoryLimit,
    setSeamlessPlayback,
    setShowTrackCovers,
    setShowTrackNumbers,
    setSleepTimerAction,
    setSleepTimerMinutes,
    setUseThemeLyricColor,
  };
}
