import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { resolveLocale } from '../i18n';
import { listLatestAddedTracks, listTracks, removeMusicDir, scanMusicDir, toAudioSource } from '../services/music';
import { readPersistentValue, removePersistentValue, writePersistentValue } from '../services/persistentStore';
import type { CustomTheme, Locale, PlaybackMode, PlaybackSession, PlayerSettings, SystemThemeState, Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import {
  CUSTOM_THEMES_KEY,
  FAVORITES_KEY,
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
  PLAYBACK_SESSION_KEY,
  QUALITY_FALLBACKS,
  SETTINGS_KEY,
  SYSTEM_THEME_KEY,
} from './player/constants';
import { resolveFavoriteTracks, toggleFavoriteTrack } from './player/favorites';
import {
  dedupeTracksByPath,
  normalizeCachedSystemThemeState,
  normalizeCustomThemes,
  normalizeFavoriteStore,
  normalizeLocalPathInput,
  normalizeSettings,
  normalizePlaybackSession,
  type CachedSystemThemeState,
} from './player/normalizers';
import {
  addTrackToPlaylistEntry,
  createPlaylistEntry,
  deletePlaylistEntry,
  removeTrackFromPlaylistEntry,
  renamePlaylistEntry,
} from './player/playlists';
import { createPlaybackSessionSnapshot, resolvePlaybackSessionRestore } from './player/playbackSession';
import { createPlayerThemeController } from './player/theme';

export const usePlayerStore = defineStore('player', () => {
  const tracks = ref<Track[]>([]);
  const latestAddedTracks = ref<Track[]>([]);
  const queue = ref<Track[]>([]);
  const currentTrack = ref<Track | null>(null);
  const favoriteTrackIds = ref<number[]>([]);
  const favoriteTrackSnapshots = ref<Track[]>([]);
  const customThemes = ref<CustomTheme[]>([]);
  const query = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const settings = ref<PlayerSettings>(fallbackSettings);
  const playbackMode = ref<PlaybackMode>('shuffle');
  const playbackSession = ref<PlaybackSession | null>(null);
  const cachedSystemThemeState = ref<CachedSystemThemeState | null>(null);
  const {
    addCustomTheme,
    applySettingsSideEffects,
    applySystemThemeState,
    handleSystemThemeChanged,
    persistSettings,
    refreshSystemThemeOnFocus,
    removeCustomTheme,
    scheduleSystemThemeRefresh,
    setTheme,
    toggleTheme,
  } = createPlayerThemeController({ settings, customThemes, cachedSystemThemeState });

  const filteredTracks = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase();
    if (!needle) return tracks.value;

    return tracks.value.filter((track) => {
      return [track.title, track.artist]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle));
    });
  });

  const currentSource = computed(() => {
    return currentTrack.value?.path ? toAudioSource(currentTrack.value.path) : '';
  });

  const favoriteTrackIdSet = computed(() => new Set(favoriteTrackIds.value));

  const favoriteTracks = computed(() => {
    return resolveFavoriteTracks(favoriteTrackIds.value, tracks.value, favoriteTrackSnapshots.value);
  });

  const playbackModeLabel = computed(() => {
    if (playbackMode.value === 'shuffle') return resolveLocale(settings.value.locale) === 'en-US' ? 'Shuffle' : '随机播放';
    if (playbackMode.value === 'repeat') return resolveLocale(settings.value.locale) === 'en-US' ? 'Repeat' : '循环播放';
    return resolveLocale(settings.value.locale) === 'en-US' ? 'Single track' : '固定播放';
  });

  async function hydratePersistedState() {
    const [
      storedSettings,
      storedFavoriteTrackIds,
      storedCustomThemes,
      storedPlaybackSession,
      storedSystemTheme,
    ] = await Promise.all([
      readPersistentValue<unknown>(SETTINGS_KEY),
      readPersistentValue<unknown>(FAVORITES_KEY),
      readPersistentValue<unknown>(CUSTOM_THEMES_KEY),
      readPersistentValue<unknown>(PLAYBACK_SESSION_KEY),
      readPersistentValue<unknown>(SYSTEM_THEME_KEY),
    ]);

    if (storedSettings) {
      settings.value = normalizeSettings(storedSettings);
    }

    if (storedFavoriteTrackIds) {
      const favorites = normalizeFavoriteStore(storedFavoriteTrackIds);
      favoriteTrackIds.value = favorites.ids;
      favoriteTrackSnapshots.value = favorites.tracks;
    }

    if (storedCustomThemes) {
      customThemes.value = normalizeCustomThemes(storedCustomThemes);
    }

    if (storedPlaybackSession) {
      playbackSession.value = normalizePlaybackSession(storedPlaybackSession);
    }

    if (storedSystemTheme) {
      const cached = normalizeCachedSystemThemeState(storedSystemTheme);
      if (cached) {
        cachedSystemThemeState.value = cached;
        applySystemThemeState(cached.state);
      }
    }

    applySettingsSideEffects();
  }

  function persistFavorites() {
    void writePersistentValue(FAVORITES_KEY, {
      ids: favoriteTrackIds.value,
      tracks: favoriteTrackSnapshots.value,
    });
  }

  function persistPlaybackSession(currentTime = 0, track?: Track | null, queueOverride?: Track[]) {
    const current = track ?? currentTrack.value;
    const queueSource = queueOverride?.length ? queueOverride : queue.value;
    const session = createPlaybackSessionSnapshot(currentTime, playbackMode.value, current, queueSource);

    if (!session) {
      void removePersistentValue(PLAYBACK_SESSION_KEY);
      playbackSession.value = null;
      return;
    }

    playbackSession.value = session;
    void writePersistentValue(PLAYBACK_SESSION_KEY, session);
  }

  function restorePlaybackSession() {
    const session = playbackSession.value;
    if (!session) return null;

    const restored = resolvePlaybackSessionRestore(session);
    if (!restored) return null;

    queue.value = restored.queue;
    currentTrack.value = restored.current;
    playbackMode.value = restored.playbackMode;

    return restored.current ? { track: restored.current, currentTime: restored.currentTime } : null;
  }

  async function loadLibrary() {
    loading.value = true;
    error.value = null;

    try {
      tracks.value = dedupeTracksByPath(await listTracks());
      latestAddedTracks.value = dedupeTracksByPath(await listLatestAddedTracks());
      queue.value = [...tracks.value];
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.includes('Scan canceled')) {
        throw err;
      }
      error.value = message;
    } finally {
      loading.value = false;
    }
  }

  async function scanLibrary(path = settings.value.musicDir) {
    if (!path.trim()) {
      error.value = resolveLocale(settings.value.locale) === 'en-US' ? 'Please select or enter a music folder first.' : '请先选择或输入音乐目录。';
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      settings.value.musicDir = path;
      if (!settings.value.musicDirs.includes(path)) {
        settings.value.musicDirs = [...settings.value.musicDirs, path];
      }
      const scanResult = await scanMusicDir(path);
      const nextTracks = dedupeTracksByPath(Array.isArray(scanResult.tracks) ? scanResult.tracks : []);
      const addedTracks = dedupeTracksByPath(Array.isArray(scanResult.addedTracks) ? scanResult.addedTracks : []);
      const addedTrackIds = addedTracks.length > 0
        ? addedTracks.map((track) => track.id)
        : (Array.isArray(scanResult.addedTrackIds) ? scanResult.addedTrackIds : []);

      if (addedTracks.length > 0 || addedTrackIds.length > 0) {
        settings.value.lastAddedMusicDir = path;
        settings.value.lastAddedTrackIds = addedTrackIds;
      }

      persistSettings();
      tracks.value = nextTracks;
      latestAddedTracks.value = addedTracks.length > 0
        ? addedTracks
        : dedupeTracksByPath(await listLatestAddedTracks());
      queue.value = [...tracks.value];
      if (currentTrack.value) {
        currentTrack.value =
          tracks.value.find((track) => track.id === currentTrack.value?.id) ??
          tracks.value.find((track) => track.path === currentTrack.value?.path) ??
          null;
      }
    } catch (err) {
      error.value = getErrorMessage(err);
    } finally {
      loading.value = false;
    }
  }

  function setCurrentTrack(track: Track | null) {
    currentTrack.value = track;
  }

  function isFavorite(track: Track | null) {
    return Boolean(track && favoriteTrackIdSet.value.has(track.id));
  }

  function toggleFavorite(track: Track | null) {
    if (!track) return false;

    const result = toggleFavoriteTrack(track, favoriteTrackIds.value, favoriteTrackSnapshots.value, tracks.value);
    favoriteTrackIds.value = result.favoriteIds;
    favoriteTrackSnapshots.value = result.snapshots;
    persistFavorites();
    return result.isFavorite;
  }

  function togglePlaybackMode() {
    if (playbackMode.value === 'shuffle') {
      playbackMode.value = 'repeat';
      return;
    }

    if (playbackMode.value === 'repeat') {
      playbackMode.value = 'fixed';
      return;
    }

    playbackMode.value = 'shuffle';
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

  async function setMusicDirs(paths: string[]) {
    const previousDirs = settings.value.musicDirs;
    settings.value.musicDirs = [...new Set(paths.filter((path) => path.trim()))];
    settings.value.musicDir = settings.value.musicDirs[0] ?? '';
    if (!settings.value.musicDirs.includes(settings.value.lastAddedMusicDir)) {
      settings.value.lastAddedMusicDir = settings.value.musicDir;
      settings.value.lastAddedTrackIds = [];
    }
    persistSettings();

    const removedDirs = previousDirs.filter((path) => !settings.value.musicDirs.includes(path));
    for (const removedDir of removedDirs) {
      tracks.value = dedupeTracksByPath(await removeMusicDir(removedDir));
    }
    if (removedDirs.length > 0) {
      latestAddedTracks.value = dedupeTracksByPath(await listLatestAddedTracks());
      queue.value = queue.value.filter((track) => tracks.value.some((item) => item.id === track.id));
      if (currentTrack.value && !tracks.value.some((track) => track.id === currentTrack.value?.id)) {
        currentTrack.value = null;
      }
    }
  }

  function recordRecentlyPlayed(track: Track | null) {
    if (!track?.path) return;

    settings.value.recentPlayedTrackIds = [
      track.id,
      ...settings.value.recentPlayedTrackIds.filter((id) => id !== track.id),
    ].slice(0, 100);
    persistSettings();
  }

  function createPlaylist(name: string, initialTracks: Array<number | Track> = []) {
    const result = createPlaylistEntry(settings.value.playlists, name, initialTracks, tracks.value, Date.now());
    if (!result.created) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function renamePlaylist(playlistId: string, name: string) {
    const result = renamePlaylistEntry(settings.value.playlists, playlistId, name);
    if (!result.renamed) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function deletePlaylist(playlistId: string) {
    const result = deletePlaylistEntry(settings.value.playlists, playlistId);
    if (!result.deleted) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function addTrackToPlaylist(track: Track, playlistId: string) {
    const result = addTrackToPlaylistEntry(settings.value.playlists, playlistId, track, tracks.value);
    if (!result.added) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function removeTrackFromPlaylist(track: Track, playlistId: string) {
    const result = removeTrackFromPlaylistEntry(settings.value.playlists, playlistId, track);
    if (!result.removed) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  applySettingsSideEffects();
  void listen<SystemThemeState>('system-theme-changed', (event) => {
    handleSystemThemeChanged(event.payload);
  });
  window.addEventListener('focus', refreshSystemThemeOnFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshSystemThemeOnFocus();
    }
  });
  if (settings.value.theme === 'wallpaperTone') {
    scheduleSystemThemeRefresh(true);
  }

  return {
    currentSource,
    currentTrack,
    error,
    favoriteTrackIds,
    favoriteTracks,
    filteredTracks,
    loading,
    playbackMode,
    playbackModeLabel,
    query,
    queue,
    settings,
    playbackSession,
    customThemes,
    tracks,
    latestAddedTracks,
    hydratePersistedState,
    loadLibrary,
    isFavorite,
    setCurrentTrack,
    persistPlaybackSession,
    restorePlaybackSession,
    recordRecentlyPlayed,
    scanLibrary,
    setMusicDirs,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    setCloseAction,
    setLocale,
    setSleepTimerAction,
    setSleepTimerMinutes,
    setAutoHideLyricsDock,
    setLyricFontSize,
    setUseThemeLyricColor,
    setLyricFontColor,
    setDownloadDir,
    setAudioCacheDir,
    setAudioCacheMaxMb,
    setAudioOutputDeviceId,
    setSearchHistoryLimit,
    setShowTrackNumbers,
    setShowTrackCovers,
    setEnableLocalMetadataEditing,
    setEnableTrackMetadataEdit,
    setEnableTrackCoverEdit,
    setEnableTrackDurationRefresh,
    setEnablePlugins,
    setQualityFallback,
    setOnlinePlaybackFailureAction,
    setSeamlessPlayback,
    setFadePlayback,
    setCrossfadePlayback,
    setMcpAutoStart,
    setTheme,
    addCustomTheme,
    removeCustomTheme,
    toggleTheme,
    toggleFavorite,
    togglePlaybackMode,
  };
});
