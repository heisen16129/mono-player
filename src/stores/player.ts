import { defineStore } from 'pinia';
import { ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { resolveLocale } from '../i18n';
import { listLatestAddedTracks, listTracks, removeMusicDir, scanMusicDir } from '../services/music';
import { readPersistentValue, removePersistentValue, writePersistentValue } from '../services/persistentStore';
import type { CustomTheme, PlaybackMode, PlaybackSession, PlayerSettings, SystemThemeState, Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import {
  CUSTOM_THEMES_KEY,
  FAVORITES_KEY,
  fallbackSettings,
  PLAYBACK_SESSION_KEY,
  SETTINGS_KEY,
  SYSTEM_THEME_KEY,
} from './player/constants';
import { createPlayerFavoriteActions } from './player/favoriteActions';
import {
  dedupeTracksByPath,
  normalizeCachedSystemThemeState,
  normalizeCustomThemes,
  normalizeFavoriteStore,
  normalizeSettings,
  normalizePlaybackSession,
  type CachedSystemThemeState,
} from './player/normalizers';
import { createPlayerPlaylistActions } from './player/playlistActions';
import { createPlayerPlaybackStateActions } from './player/playbackStateActions';
import { createPlaybackSessionSnapshot, resolvePlaybackSessionRestore } from './player/playbackSession';
import { createPlayerSettingsActions } from './player/settingsActions';
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

  const { favoriteTracks, isFavorite, toggleFavorite } = createPlayerFavoriteActions({
    favoriteTrackIds,
    favoriteTrackSnapshots,
    persistFavorites,
    tracks,
  });

  const {
    currentSource,
    filteredTracks,
    playbackModeLabel,
    recordRecentlyPlayed,
    setCurrentTrack,
    togglePlaybackMode,
  } = createPlayerPlaybackStateActions({ currentTrack, persistSettings, playbackMode, query, settings, tracks });

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

  const {
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
  } = createPlayerSettingsActions({ persistSettings, settings });

  const {
    addTrackToPlaylist,
    createPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    renamePlaylist,
  } = createPlayerPlaylistActions({ persistSettings, settings, tracks });

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
    setEnableAppShortcuts,
    setAppShortcut,
    setMcpAutoStart,
    setTheme,
    addCustomTheme,
    removeCustomTheme,
    toggleTheme,
    toggleFavorite,
    togglePlaybackMode,
  };
});
