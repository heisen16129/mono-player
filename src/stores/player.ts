import { preloadStartupCovers } from '../services/startupCovers';
import { useLibrarySearch } from '../composables/useLibrarySearch';
import { useLibraryStatistics } from '../composables/useLibraryStatistics';
import { defineStore } from 'pinia';
import { nextTick, ref, watch } from 'vue';
import { resolveLocale } from '../i18n';
import { listLatestAddedTracks, listTracks, updateLibraryDirectories, scanMusicDirs } from '../services/music';
import { listThemes } from '../services/themes';
import { readPersistentValue } from '../services/persistentStore';
import type { CustomTheme, PlaybackMode, PlaybackSession, PlayerSettings, Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import {
  fallbackSettings,
  SETTINGS_KEY,
} from './player/constants';
import { createPlayerFavoriteActions } from './player/favoriteActions';
import {
  dedupeTracksByPath,
} from './player/normalizers';
import { createPlayerPlaylistActions } from './player/playlistActions';
import { createPlayerPlaybackStateActions } from './player/playbackStateActions';
import { readPlaybackSession } from '../services/playbackSession';
import { createRecentPlayedActions } from './player/recentPlayed';
import { createPlayerSettingsActions } from './player/settingsActions';
import { createPlayerThemeController } from './player/theme';

export const usePlayerStore = defineStore('player', () => {
  const tracks = ref<Track[]>([]);
  const latestAddedTracks = ref<Track[]>([]);
  const queue = ref<Track[]>([]);
  const currentTrack = ref<Track | null>(null);
  const customThemes = ref<CustomTheme[]>([]);
  const query = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const settings = ref<PlayerSettings>(fallbackSettings);
  const { libraryStatistics, refreshLibraryStatistics } = useLibraryStatistics({ tracks, settings, query, error });
  const playbackMode = ref<PlaybackMode>('shuffle');
  const playbackSession = ref<PlaybackSession | null>(null);
  const {
    reloadThemes,
    addCustomTheme,
    applySettingsSideEffects,
    persistSettings,
    removeCustomTheme,
    setTheme,
  } = createPlayerThemeController({ settings, customThemes, onSettingsError: (err) => { error.value = getErrorMessage(err); } });

  const { favoriteStatistics, favoriteTracks, favoriteTrackIds, isFavorite, toggleFavorite, addFavoriteTrack, reloadFavorites } = createPlayerFavoriteActions({
    error,
  });

  const {
    currentSource,
    playbackModeLabel,
    setCurrentTrack,
    togglePlaybackMode,
  } = createPlayerPlaybackStateActions({
    currentTrack,
    playbackMode,
    settings,
  });

  const { recentPlayedTracks, reloadRecentlyPlayed } = createRecentPlayedActions();

  const { refreshLibrarySearch, libraryListStatistics, libraryListTotals, filteredTracks, filteredLatestAddedTracks, filteredRecentPlayedTracks } = useLibrarySearch({
    tracks, latestAddedTracks, recentPlayedTracks, query, error,
  });

  async function hydratePersistedState() {
    const [
      storedSettings,
      storedCustomThemes,
      storedPlaybackSession,
    ] = await Promise.all([
      readPersistentValue<PlayerSettings>(SETTINGS_KEY),
      listThemes(),
      readPlaybackSession(),
      reloadFavorites(),
      reloadPlaylists(),
      reloadRecentlyPlayed(),
    ]);

    if (storedSettings) {
      settings.value = storedSettings;
    }

    if (storedCustomThemes) {
      customThemes.value = storedCustomThemes.themes;
      settings.value.theme = storedCustomThemes.activeTheme;
    }

    if (storedPlaybackSession) {
      playbackSession.value = storedPlaybackSession;
    }

    applySettingsSideEffects();
  }


  const {
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
  } = createPlayerSettingsActions({ persistSettings, settings });

  const {
    playlists,
    reloadPlaylists,
    addTrackToPlaylist,
    createPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    renamePlaylist,
    updatePlaylistCover,
  } = createPlayerPlaylistActions({ error });

  watch(tracks, () => {
    void Promise.all([reloadFavorites(), reloadPlaylists()]).catch(err => { error.value = getErrorMessage(err); });
  }, { deep: true });

  async function prepareStartupView() {
    await nextTick();
    await Promise.all([refreshLibrarySearch(), refreshLibraryStatistics(), reloadFavorites(), reloadPlaylists()]);
    await preloadStartupCovers([
      ...filteredTracks.value.slice(0, 24),
      ...libraryStatistics.value.folders.flatMap(folder => folder.tracks.slice(0, 4)),
      ...(currentTrack.value ? [currentTrack.value] : []),
    ]);
  }

  function restorePlaybackSession() {
    const session = playbackSession.value;
    if (!session?.currentTrack) {
      const first = tracks.value[0] ?? null;
      queue.value = [...tracks.value];
      currentTrack.value = first;
      return first ? { track: first, currentTime: 0 } : null;
    }

    queue.value = session.queueTracks;
    currentTrack.value = session.currentTrack;
    playbackMode.value = session.playbackMode;
    return session.currentTrack ? { track: session.currentTrack, currentTime: session.currentTime } : null;
  }

  async function loadLibrary() {
    const previousQueue = queue.value;
    loading.value = true;
    error.value = null;

    try {
      tracks.value = dedupeTracksByPath(await listTracks());
      latestAddedTracks.value = dedupeTracksByPath(await listLatestAddedTracks());
      if (queue.value === previousQueue) queue.value = [...tracks.value];
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
    try { await scanLibraries([path]); } catch { /* scanLibraries exposes the error in the store. */ }
  }

  async function scanLibraries(paths: string[]) {
    const path = paths[paths.length - 1] ?? '';
    if (!path.trim()) {
      error.value = resolveLocale(settings.value.locale) === 'en-US' ? 'Please select or enter a music folder first.' : '请先选择或输入音乐目录。';
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const scanResult = await scanMusicDirs(paths);
      const nextTracks = dedupeTracksByPath(Array.isArray(scanResult.tracks) ? scanResult.tracks : []);
      settings.value.musicDirs = scanResult.musicDirs;
      settings.value.musicDir = scanResult.musicDir;
      tracks.value = nextTracks;
      latestAddedTracks.value = dedupeTracksByPath(await listLatestAddedTracks());
      queue.value = [...tracks.value];
      if (currentTrack.value) {
        currentTrack.value =
          tracks.value.find((track) => track.id === currentTrack.value?.id) ??
          tracks.value.find((track) => track.path === currentTrack.value?.path) ??
          null;
      }
      return scanResult;
    } catch (err) {
      await loadLibrary();
      const savedSettings = await readPersistentValue<PlayerSettings>(SETTINGS_KEY).catch(() => null);
      if (savedSettings) {
        settings.value.musicDirs = savedSettings.musicDirs;
        settings.value.musicDir = savedSettings.musicDir;
      }
      error.value = getErrorMessage(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function setMusicDirs(paths: string[]) {
    try {
      const result = await updateLibraryDirectories(paths);
      settings.value.musicDirs = result.musicDirs;
      settings.value.musicDir = result.musicDir;
      tracks.value = result.tracks;
      latestAddedTracks.value = result.latestAddedTracks;
      await Promise.all([reloadFavorites(), reloadPlaylists(), reloadRecentlyPlayed(), refreshLibraryStatistics(), refreshLibrarySearch()]);
    } catch (err) {
      error.value = getErrorMessage(err);
      throw err;
    }
  }

  applySettingsSideEffects();

  return {
    currentSource,
    currentTrack,
    error,
    favoriteTrackIds,
    favoriteStatistics,
    favoriteTracks,
    libraryListStatistics,
    libraryListTotals,
    filteredTracks,
    filteredLatestAddedTracks,
    filteredRecentPlayedTracks,
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
    libraryStatistics,
    hydratePersistedState,
    reloadFavorites,
    recentPlayedTracks,
    reloadRecentlyPlayed,
    playlists,
    reloadPlaylists,
    loadLibrary,
    isFavorite,
    setCurrentTrack,
    restorePlaybackSession,
    prepareStartupView,
    scanLibrary,
    scanLibraries,
    setMusicDirs,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    updatePlaylistCover,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    setCloseAction,
    setLocale,
    setSleepTimerAction,
    setSleepTimerMinutes,
    setLyricFontSize,
    setUseThemeLyricColor,
    setLyricFontColor,
    setLyricEffectColor,
    setLyricsBackground,
    previewLyricsBackground,
    setDownloadDir,
    setAudioCacheDir,
    setAudioCacheMaxMb,
    setAudioOutputDeviceId,
    setSearchHistoryLimit,
    setShowTrackNumbers,
    setShowTrackCovers,
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
    reloadThemes,
    addCustomTheme,
    removeCustomTheme,
    toggleFavorite,
    addFavoriteTrack,
    togglePlaybackMode,
  };
});
