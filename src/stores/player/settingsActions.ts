import type { Ref } from 'vue';
import type { Locale, LyricsBackgroundSettings, PlayerSettings, ShortcutAction } from '../../types/music';
import { normalizeLyricsBackground } from './settingsNormalizers';

interface PlayerSettingsActionsOptions {
  persistSettings: (refreshTheme?: boolean) => void;
  settings: Ref<PlayerSettings>;
}

export function createPlayerSettingsActions({ persistSettings, settings }: PlayerSettingsActionsOptions) {
  function applyLyricsBackgroundPatch(patch: Partial<LyricsBackgroundSettings>) {
    settings.value.lyricsBackground = normalizeLyricsBackground({
      ...settings.value.lyricsBackground,
      ...patch,
    });
  }

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
    settings.value.sleepTimerMinutes = minutes;
    persistSettings();
  }

  function setLyricFontSize(size: number) {
    settings.value.lyricFontSize = size;
    persistSettings();
  }

  function setUseThemeLyricColor(enabled: boolean) {
    if (settings.value.useThemeLyricColor === enabled) return;
    settings.value.useThemeLyricColor = enabled;
    persistSettings(false);
  }

  function setLyricFontColor(color: string) {
    if (settings.value.lyricFontColor === color && !settings.value.useThemeLyricColor) return;
    settings.value.lyricFontColor = color;
    settings.value.useThemeLyricColor = false;
    persistSettings(false);
  }

  function setLyricEffectColor(key: 'lyricHighlightColor' | 'lyricGlowColor', color: string) {
    if ((settings.value[key] || '') === color) return;
    settings.value[key] = color;
    persistSettings(false);
  }

  function setLyricsBackground(patch: Partial<LyricsBackgroundSettings>) {
    settings.value.lyricsBackground = { ...settings.value.lyricsBackground, ...patch };
    persistSettings();
  }

  function previewLyricsBackground(patch: Partial<LyricsBackgroundSettings>) {
    applyLyricsBackgroundPatch(patch);
  }

  function setDownloadDir(path: string) {
    settings.value.downloadDir = path;
    persistSettings();
  }

  function setAudioCacheDir(path: string) {
    settings.value.audioCacheDir = path;
    persistSettings();
  }

  function setAudioCacheMaxMb(sizeMb: number) {
    settings.value.audioCacheMaxMb = sizeMb;
    persistSettings();
  }

  function setAudioOutputDeviceId(deviceId: string) {
    settings.value.audioOutputDeviceId = deviceId;
    persistSettings();
  }

  function setSearchHistoryLimit(limit: number) {
    settings.value.searchHistoryLimit = limit;
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
    settings.value.qualityFallback = fallback;
    persistSettings();
  }

  function setOnlinePlaybackFailureAction(action: PlayerSettings['onlinePlaybackFailureAction']) {
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
    settings.value.appShortcuts = { ...settings.value.appShortcuts, [action]: shortcut };
    persistSettings();
  }

  return {
    setAudioCacheDir,
    setAudioCacheMaxMb,
    setAudioOutputDeviceId,
    setCloseAction,
    setCrossfadePlayback,
    setDownloadDir,
    setAppShortcut,
    setEnableAppShortcuts,
    setEnablePlugins,
    setEnableTrackCoverEdit,
    setEnableTrackDurationRefresh,
    setEnableTrackMetadataEdit,
    setFadePlayback,
    setLocale,
    setLyricFontColor,
    setLyricEffectColor,
    setLyricFontSize,
    setLyricsBackground,
    previewLyricsBackground,
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
