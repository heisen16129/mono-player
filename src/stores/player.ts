import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { resolveLocale } from '../i18n';
import { getSystemThemeState, listLatestAddedTracks, listTracks, removeMusicDir, scanMusicDir, toAudioSource } from '../services/music';
import { setRustBackendQueue } from '../services/playerBackend';
import { readPersistentValue, removePersistentValue, writePersistentValue } from '../services/persistentStore';
import type { AppTheme, CustomTheme, Locale, PlaybackMode, PlaybackSession, PlayerSettings, SystemThemeState, Track, UserPlaylist } from '../types/music';
import { getErrorMessage } from '../utils/error';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

const SETTINGS_KEY = 'mono-player-settings';
const FAVORITES_KEY = 'mono-player-favorites';
const CUSTOM_THEMES_KEY = 'mono-player-custom-themes';
const SYSTEM_THEME_KEY = 'mono-player-system-theme-state';
const PLAYBACK_SESSION_KEY = 'mono-player-playback-session';
const STARTUP_THEME_KEY = 'mono-player-startup-theme';
const STARTUP_BG_KEY = 'mono-player-startup-bg';
const MIN_LYRIC_FONT_SIZE = 14;
const MAX_LYRIC_FONT_SIZE = 34;
const MIN_SLEEP_TIMER_MINUTES = 1;
const MAX_SLEEP_TIMER_MINUTES = 999;
const MIN_SEARCH_HISTORY_LIMIT = 1;
const MAX_SEARCH_HISTORY_LIMIT = 25;
const MIN_AUDIO_CACHE_MAX_MB = 64;
const MAX_AUDIO_CACHE_MAX_MB = 51200;
const QUALITY_FALLBACKS = ['lower', 'higher', 'none'] as const;
const ONLINE_PLAYBACK_FAILURE_ACTIONS = ['pause', 'next'] as const;

interface CachedSystemThemeState {
  state: SystemThemeState;
  savedAt: number;
}

const fallbackSettings: PlayerSettings = {
  musicDir: '',
  musicDirs: [],
  lastAddedMusicDir: '',
  lastAddedTrackIds: [],
  recentPlayedTrackIds: [],
  playlists: [],
  theme: 'blueWhite',
  closeAction: 'exit',
  locale: 'system',
  sleepTimerAction: 'stop',
  sleepTimerMinutes: 30,
  autoHideLyricsDock: false,
  lyricFontSize: 17,
  useThemeLyricColor: true,
  lyricFontColor: '#e31a1a',
  downloadDir: '',
  audioCacheDir: '',
  audioCacheMaxMb: 1024,
  audioOutputDeviceId: '',
  searchHistoryLimit: 10,
  showTrackNumbers: true,
  showTrackCovers: true,
  enableLocalMetadataEditing: false,
  enableTrackMetadataEdit: false,
  enableTrackCoverEdit: false,
  enableTrackDurationRefresh: false,
  enablePlugins: false,
  qualityFallback: 'lower',
  onlinePlaybackFailureAction: 'pause',
  seamlessPlayback: true,
  fadePlayback: false,
  crossfadePlayback: false,
  mcpAutoStart: true,
};

function normalizeSettings(value: unknown): PlayerSettings {
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

function normalizeTrackPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/\/\?\//, '').toLocaleLowerCase();
}

function normalizeLocalPathInput(path: string) {
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

function dedupeTracksByPath(items: Track[]) {
  const seenPaths = new Set<string>();
  return items.filter((track) => {
    const path = normalizeTrackPath(track.path);
    if (!path || seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  });
}

function normalizeFavoriteTrackIds(value: unknown): number[] {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  return [...new Set(ids)];
}

function normalizeFavoriteTrack(value: unknown): Track | null {
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
    lyrics: normalizeTrackLyrics(parsed as Track),
    sourceId: typeof parsed.sourceId === 'string' ? parsed.sourceId : null,
    sourceName: typeof parsed.sourceName === 'string' ? parsed.sourceName : null,
    sourceProviderId: typeof parsed.sourceProviderId === 'string' ? parsed.sourceProviderId : null,
    sourceRaw: parsed.sourceRaw,
  };
}

function normalizeFavoriteTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];
  const tracks = value
    .map((track) => normalizeFavoriteTrack(track))
    .filter((track): track is Track => Boolean(track));
  const trackById = new Map<number, Track>();
  for (const track of tracks) {
    trackById.set(track.id, track);
  }
  return [...trackById.values()];
}

function normalizeFavoriteStore(value: unknown): { ids: number[]; tracks: Track[] } {
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

function normalizeCustomThemes(value: unknown): CustomTheme[] {
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

function normalizePlaybackSession(value: unknown): PlaybackSession | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const parsed = value as Partial<PlaybackSession>;
    const playbackMode: PlaybackMode =
      parsed.playbackMode === 'repeat' || parsed.playbackMode === 'fixed' ? parsed.playbackMode : 'shuffle';
    const currentTime = Number(parsed.currentTime);

    return {
      currentTrackId: typeof parsed.currentTrackId === 'number' ? parsed.currentTrackId : null,
      currentTrackPath: typeof parsed.currentTrackPath === 'string' ? parsed.currentTrackPath : null,
      queueTrackIds: Array.isArray(parsed.queueTrackIds)
        ? parsed.queueTrackIds.filter((id): id is number => typeof id === 'number')
        : [],
      queueTrackPaths: Array.isArray(parsed.queueTrackPaths)
        ? parsed.queueTrackPaths.filter((path): path is string => typeof path === 'string' && path.length > 0)
        : [],
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      playbackMode,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

function isBuiltInTheme(theme: string): theme is Exclude<AppTheme, `custom:${string}`> {
  return theme === 'dark' || theme === 'light' || theme === 'blueWhite' || theme === 'wallpaperTone' || theme === 'desktopGlass';
}

function isCustomTheme(theme: AppTheme): theme is `custom:${string}` {
  return theme.startsWith('custom:');
}

function normalizeCachedSystemThemeState(value: unknown): CachedSystemThemeState | null {
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

function writeCachedSystemThemeState(state: SystemThemeState) {
  void writePersistentValue(SYSTEM_THEME_KEY, { state, savedAt: Date.now() });
}

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
  const queuedNextTrackId = ref<number | null>(null);
  let systemThemeRefreshTask: Promise<void> | null = null;
  let systemThemeRefreshTimer: number | null = null;
  let lastSystemThemeRefreshRequestedAt = 0;
  let lastSystemThemeMode = '';
  const appliedCustomThemeVariables = new Set<string>();
  const appliedSystemThemeVariables = new Set<string>();

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
    const localTrackById = new Map(tracks.value.map((track) => [track.id, track]));
    const snapshotById = new Map(favoriteTrackSnapshots.value.map((track) => [track.id, track]));
    return favoriteTrackIds.value
      .map((id) => localTrackById.get(id) ?? snapshotById.get(id))
      .filter((track): track is Track => Boolean(track));
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

  function applySettingsSideEffects() {
    document.documentElement.dataset.theme = isCustomTheme(settings.value.theme) ? 'custom' : settings.value.theme;
    document.documentElement.lang = resolveLocale(settings.value.locale);
    void writePersistentValue(STARTUP_THEME_KEY, settings.value.theme);
    applyCustomThemeVariables();
    if (settings.value.theme === 'wallpaperTone') {
      applyCachedSystemTheme();
    } else {
      clearSystemThemeVariables();
    }
    persistStartupBackground();
  }

  function persistStartupBackground() {
    requestAnimationFrame(() => {
      const startupBg = getComputedStyle(document.documentElement).getPropertyValue('--smw-startup-bg').trim();
      if (startupBg) {
        void writePersistentValue(STARTUP_BG_KEY, startupBg);
      }
    });
  }

  function persistSettings() {
    void writePersistentValue(SETTINGS_KEY, settings.value);
    applySettingsSideEffects();
  }

  function persistFavorites() {
    void writePersistentValue(FAVORITES_KEY, {
      ids: favoriteTrackIds.value,
      tracks: favoriteTrackSnapshots.value,
    });
  }

  function persistCustomThemes() {
    void writePersistentValue(CUSTOM_THEMES_KEY, customThemes.value);
  }

  function persistPlaybackSession(currentTime = 0, track?: Track | null, queueOverride?: Track[]) {
    const current = track ?? currentTrack.value;
    const queueSource = queueOverride?.length ? queueOverride : queue.value;
    const nextQueue = queueSource.filter((item) => item.path);
    if (current?.path && !nextQueue.some((item) => item.path === current.path)) {
      nextQueue.unshift(current);
    }

    if (!current && nextQueue.length === 0) {
      void removePersistentValue(PLAYBACK_SESSION_KEY);
      playbackSession.value = null;
      return;
    }

    const session: PlaybackSession = {
      currentTrackId: current?.id ?? null,
      currentTrackPath: current?.path ?? null,
      queueTrackIds: nextQueue.map((track) => track.id),
      queueTrackPaths: nextQueue.map((track) => track.path),
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      playbackMode: playbackMode.value,
      savedAt: Date.now(),
    };

    playbackSession.value = session;
    void writePersistentValue(PLAYBACK_SESSION_KEY, session);
  }

  function restorePlaybackSession() {
    const session = playbackSession.value;
    if (!session || tracks.value.length === 0) return null;

    const byId = new Map(tracks.value.map((track) => [track.id, track]));
    const byPath = new Map(tracks.value.map((track) => [track.path, track]));
    const restoredQueue = dedupeTracksByPath(session.queueTrackPaths
      .map((path, index) => byPath.get(path) ?? byId.get(session.queueTrackIds[index] ?? -1))
      .filter((track): track is Track => Boolean(track?.path)));
    const nextQueue = restoredQueue.length > 0 ? restoredQueue : tracks.value.filter((track) => track.path);
    const current =
      (session.currentTrackId !== null ? byId.get(session.currentTrackId) : null) ??
      (session.currentTrackPath ? byPath.get(session.currentTrackPath) : null) ??
      nextQueue[0] ??
      null;

    queue.value = nextQueue;
    currentTrack.value = current;
    playbackMode.value = session.playbackMode;

    return current ? { track: current, currentTime: session.currentTime } : null;
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

  function play(track: Track) {
    currentTrack.value = track;
    if (!queue.value.some((item) => item.id === track.id)) {
      queue.value = [track, ...queue.value];
    }
  }

  function setCurrentTrack(track: Track | null) {
    currentTrack.value = track;
  }

  function playQueue(nextQueue: Track[], startTrack?: Track) {
    const playable = nextQueue.filter((track) => track.path);
    if (playable.length === 0) return null;

    queue.value = [...playable];
    queuedNextTrackId.value = null;
    currentTrack.value =
      startTrack && playable.some((track) => track.id === startTrack.id) ? startTrack : playable[0];
    return currentTrack.value;
  }

  function queueNext(track: Track) {
    if (!track.path) return false;

    const source = queue.value.length > 0 ? queue.value : tracks.value;
    const nextQueue = source.filter((item) => item.path && item.id !== track.id);
    const currentIndex = currentTrack.value
      ? nextQueue.findIndex((item) => item.id === currentTrack.value?.id)
      : -1;
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

    nextQueue.splice(insertIndex, 0, track);
    queue.value = nextQueue;
    queuedNextTrackId.value = track.id;
    return true;
  }

  function queueLast(track: Track) {
    if (!track.path) return false;

    const source = queue.value.length > 0 ? queue.value : [];
    queue.value = [...source.filter((item) => item.path), track];
    return true;
  }

  function isFavorite(track: Track | null) {
    return Boolean(track && favoriteTrackIdSet.value.has(track.id));
  }

  function createFavoriteTrackSnapshot(track: Track): Track {
    return {
      id: track.id,
      path: track.path,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      artwork: track.artwork ?? null,
      lyrics: normalizeTrackLyrics(track),
      sourceId: track.sourceId ?? null,
      sourceName: track.sourceName ?? null,
      sourceProviderId: track.sourceProviderId ?? null,
      sourceRaw: track.sourceRaw,
    };
  }

  function toggleFavorite(track: Track | null) {
    if (!track) return false;

    if (favoriteTrackIdSet.value.has(track.id)) {
      favoriteTrackIds.value = favoriteTrackIds.value.filter((id) => id !== track.id);
      favoriteTrackSnapshots.value = favoriteTrackSnapshots.value.filter((item) => item.id !== track.id);
      persistFavorites();
      return false;
    }

    favoriteTrackIds.value = [track.id, ...favoriteTrackIds.value.filter((id) => id !== track.id)];
    if (!tracks.value.some((item) => item.id === track.id)) {
      favoriteTrackSnapshots.value = [
        ...favoriteTrackSnapshots.value.filter((item) => item.id !== track.id),
        createFavoriteTrackSnapshot(track),
      ];
    }
    persistFavorites();
    return true;
  }

  function playableQueue() {
    const source = queue.value.length > 0 ? queue.value : tracks.value;
    return source.filter((track) => track.path);
  }

  function findCurrentIndex(playable: Track[]) {
    return currentTrack.value ? playable.findIndex((track) => track.id === currentTrack.value?.id) : -1;
  }

  function pickRandomTrack(playable: Track[]) {
    if (playable.length === 0) return null;
    if (playable.length === 1) return playable[0];

    const currentIndex = findCurrentIndex(playable);
    let nextIndex = Math.floor(Math.random() * playable.length);
    if (nextIndex === currentIndex) {
      nextIndex = (nextIndex + 1) % playable.length;
    }
    return playable[nextIndex];
  }

  function keepCurrentTrack(playable: Track[]) {
    if (currentTrack.value?.path) return currentTrack.value;
    return playable[0] ?? null;
  }

  function playPrevious() {
    const playable = playableQueue();
    if (playable.length === 0) return null;

    if (playbackMode.value === 'fixed') {
      currentTrack.value = keepCurrentTrack(playable);
      return currentTrack.value;
    }

    if (playbackMode.value === 'shuffle') {
      currentTrack.value = pickRandomTrack(playable);
      return currentTrack.value;
    }

    const currentIndex = findCurrentIndex(playable);
    const previousIndex = currentIndex >= 0 ? (currentIndex - 1 + playable.length) % playable.length : 0;
    currentTrack.value = playable[previousIndex];
    return currentTrack.value;
  }

  function playNext() {
    const playable = playableQueue();
    if (playable.length === 0) return null;

    if (queuedNextTrackId.value !== null) {
      const queuedTrack = playable.find((track) => track.id === queuedNextTrackId.value);
      queuedNextTrackId.value = null;
      if (queuedTrack) {
        currentTrack.value = queuedTrack;
        return currentTrack.value;
      }
    }

    if (playbackMode.value === 'fixed') {
      currentTrack.value = keepCurrentTrack(playable);
      return currentTrack.value;
    }

    if (playbackMode.value === 'shuffle') {
      currentTrack.value = pickRandomTrack(playable);
      return currentTrack.value;
    }

    const currentIndex = findCurrentIndex(playable);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playable.length : 0;
    currentTrack.value = playable[nextIndex];
    return currentTrack.value;
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

  function toggleTheme() {
    settings.value.theme =
      settings.value.theme === 'dark'
        ? 'light'
        : settings.value.theme === 'light'
          ? 'blueWhite'
          : settings.value.theme === 'blueWhite'
            ? 'wallpaperTone'
            : settings.value.theme === 'wallpaperTone'
              ? 'desktopGlass'
            : 'dark';
    persistSettings();
    if (settings.value.theme === 'wallpaperTone') {
      scheduleSystemThemeRefresh(true);
    }
  }

  function setTheme(theme: PlayerSettings['theme']) {
    if (settings.value.theme === theme) {
      applyCustomThemeVariables();
      if (theme === 'wallpaperTone') {
        scheduleSystemThemeRefresh(true);
      }
      return;
    }

    settings.value.theme = theme;
    persistSettings();
    if (theme === 'wallpaperTone') {
      scheduleSystemThemeRefresh(true);
    }
  }

  function addCustomTheme(theme: CustomTheme, useImmediately = true) {
    customThemes.value = [theme, ...customThemes.value.filter((item) => item.id !== theme.id)];
    persistCustomThemes();
    if (useImmediately) {
      setTheme(theme.id);
    }
  }

  function removeCustomTheme(themeId: CustomTheme['id']) {
    customThemes.value = customThemes.value.filter((theme) => theme.id !== themeId);
    persistCustomThemes();
    if (settings.value.theme === themeId) {
      setTheme('wallpaperTone');
      return;
    }

    applyCustomThemeVariables();
  }

  function applyCustomThemeVariables() {
    const rootStyle = document.documentElement.style;
    for (const name of appliedCustomThemeVariables) {
      rootStyle.removeProperty(name);
    }
    appliedCustomThemeVariables.clear();

    if (!isCustomTheme(settings.value.theme)) return;

    const theme = customThemes.value.find((item) => item.id === settings.value.theme);
    if (!theme) return;

    Object.entries(theme.variables).forEach(([name, value]) => {
      rootStyle.setProperty(name, value);
      appliedCustomThemeVariables.add(name);
    });

    if (theme.background) {
      rootStyle.setProperty('--smw-theme-bg-image', `url("${themeAssetSrc(theme.background)}")`);
      appliedCustomThemeVariables.add('--smw-theme-bg-image');
    }

    if (typeof theme.backgroundOpacity === 'number') {
      rootStyle.setProperty('--smw-theme-bg-opacity', `${theme.backgroundOpacity}`);
      appliedCustomThemeVariables.add('--smw-theme-bg-opacity');
    }
  }

  function themeAssetSrc(path: string) {
    if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
    return convertFileSrc(path);
  }

  function systemThemeAccent(state: SystemThemeState, fallback: string) {
    const color = state.wallpaperColor;
    if (!color) return fallback;

    return `rgb(${color.r} ${color.g} ${color.b})`;
  }

  function systemThemeVariables(state: SystemThemeState) {
    const mode = state.mode;
    const systemAccent = systemThemeAccent(state, mode === 'dark' ? '#6d7480' : '#dfe4f2');

    if (mode === 'dark') {
      return {
        '--smw-system-base': '#0f0f10',
        '--smw-system-accent': systemAccent,
        '--smw-bg-canvas': 'var(--smw-system-base)',
        '--smw-bg-page': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
        '--smw-bg-sidebar': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 10%)',
        '--smw-bg-panel': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 12%)',
        '--smw-library-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 12%)',
        '--smw-library-border': 'color-mix(in srgb, var(--smw-system-base), white 14%)',
        '--smw-bg-workspace': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
        '--smw-bg-input': 'color-mix(in srgb, var(--smw-system-base), white 10%)',
        '--smw-bg-selected': 'color-mix(in srgb, var(--smw-system-base), white 13%)',
        '--smw-bg-hover': 'color-mix(in srgb, var(--smw-system-base), white 10%)',
        '--smw-border': 'color-mix(in srgb, var(--smw-system-base), white 17%)',
        '--smw-border-soft': 'color-mix(in srgb, var(--smw-system-base), white 12%)',
        '--smw-border-strong': 'color-mix(in srgb, var(--smw-system-base), white 54%)',
        '--smw-window-border': 'color-mix(in srgb, var(--smw-system-base), white 14%)',
        '--smw-player-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 10%)',
        '--smw-shell-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 6%)',
        '--smw-text-primary': '#f2f2f2',
        '--smw-text-body': '#e2e2e2',
        '--smw-text-secondary': '#b5b7bc',
        '--smw-text-muted': '#7d8088',
        '--smw-icon-muted': '#b5b7bc',
        '--smw-button-primary': '#f2f2f2',
        '--smw-scrollbar-thumb': 'rgba(242, 242, 242, 0.22)',
        '--smw-scrollbar-thumb-hover': 'rgba(242, 242, 242, 0.38)',
        '--smw-accent-blue': 'color-mix(in srgb, var(--smw-system-accent), white 28%)',
        '--smw-lyrics-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
        '--smw-lyrics-glow-left': 'color-mix(in srgb, var(--smw-system-accent) 14%, transparent)',
        '--smw-lyrics-glow-right': 'color-mix(in srgb, var(--smw-system-accent) 18%, transparent)',
        '--smw-lyrics-current': '#f2f2f2',
        '--smw-volume-bg': 'color-mix(in srgb, var(--smw-system-base), white 10%)',
        '--smw-volume-track': 'color-mix(in srgb, var(--smw-system-base), white 18%)',
        '--smw-volume-fill': '#f2f2f2',
        '--smw-volume-thumb': '#f2f2f2',
        '--smw-volume-text': '#b5b7bc',
        '--smw-progress-track': 'color-mix(in srgb, var(--smw-system-base), white 18%)',
        '--smw-progress-fill': '#f2f2f2',
        '--smw-progress-thumb': '#f2f2f2',
        '--smw-progress-thumb-border': 'color-mix(in srgb, var(--smw-system-base), white 8%)',
        '--smw-progress-thumb-ring': 'rgba(242, 242, 242, 0.22)',
        '--smw-error-text': '#ffb0a8',
        '--smw-error-bg': 'color-mix(in srgb, #4a1f1f, var(--smw-system-base) 62%)',
        '--smw-error-border': 'color-mix(in srgb, #b05a5a, var(--smw-system-base) 54%)',
      };
    }

    return {
      '--smw-system-base': '#fbfbfd',
      '--smw-system-accent': systemAccent,
      '--smw-bg-canvas': 'var(--smw-system-base)',
      '--smw-bg-page': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 12%)',
      '--smw-bg-sidebar': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 18%)',
      '--smw-bg-panel': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 14%)',
      '--smw-library-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 14%)',
      '--smw-library-border': 'color-mix(in srgb, var(--smw-system-base), black 12%)',
      '--smw-bg-workspace': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 8%)',
      '--smw-bg-input': '#ffffff',
      '--smw-bg-selected': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 24%)',
      '--smw-bg-hover': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 18%)',
      '--smw-border': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 34%)',
      '--smw-border-soft': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 24%)',
      '--smw-border-strong': '#242426',
      '--smw-window-border': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 38%)',
      '--smw-player-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 20%)',
      '--smw-shell-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 18%)',
      '--smw-text-primary': '#111113',
      '--smw-text-body': '#252529',
      '--smw-text-secondary': '#6f7178',
      '--smw-text-muted': '#9a9ca3',
      '--smw-icon-muted': '#676970',
      '--smw-button-primary': '#242426',
      '--smw-scrollbar-thumb': 'rgba(17, 17, 19, 0.18)',
      '--smw-scrollbar-thumb-hover': 'rgba(17, 17, 19, 0.34)',
      '--smw-accent-blue': 'color-mix(in srgb, var(--smw-system-accent), #4f8fe8 36%)',
      '--smw-lyrics-bg': 'color-mix(in srgb, var(--smw-system-base), var(--smw-system-accent) 10%)',
      '--smw-lyrics-glow-left': 'color-mix(in srgb, var(--smw-system-accent) 16%, transparent)',
      '--smw-lyrics-glow-right': 'color-mix(in srgb, var(--smw-system-accent) 24%, transparent)',
      '--smw-lyrics-current': '#242426',
      '--smw-volume-bg': '#ffffff',
      '--smw-volume-track': 'color-mix(in srgb, var(--smw-system-base), black 12%)',
      '--smw-volume-fill': '#242426',
      '--smw-volume-thumb': '#242426',
      '--smw-volume-text': '#6f7178',
      '--smw-progress-track': 'color-mix(in srgb, var(--smw-system-base), black 12%)',
      '--smw-progress-fill': '#4f8fe8',
      '--smw-progress-thumb': '#4f8fe8',
      '--smw-progress-thumb-border': 'color-mix(in srgb, var(--smw-system-base), black 3%)',
      '--smw-progress-thumb-ring': 'rgba(79, 143, 232, 0.24)',
      '--smw-error-text': '#8a3333',
      '--smw-error-bg': '#fff7f7',
      '--smw-error-border': '#d8b8b8',
    };
  }

  function clearSystemThemeVariables() {
    const rootStyle = document.documentElement.style;
    for (const name of appliedSystemThemeVariables) {
      rootStyle.removeProperty(name);
    }
    appliedSystemThemeVariables.clear();
    lastSystemThemeMode = '';
  }

  function applySystemThemeState(state: SystemThemeState) {
    if (settings.value.theme !== 'wallpaperTone') return;
    const systemThemeKey = JSON.stringify(state);
    if (systemThemeKey === lastSystemThemeMode && appliedSystemThemeVariables.size > 0) return;

    clearSystemThemeVariables();
    lastSystemThemeMode = systemThemeKey;

    const rootStyle = document.documentElement.style;
    Object.entries(systemThemeVariables(state)).forEach(([name, value]) => {
      rootStyle.setProperty(name, value);
      appliedSystemThemeVariables.add(name);
    });
    persistStartupBackground();
  }

  function applyCachedSystemTheme() {
    applySystemThemeState(cachedSystemThemeState.value?.state ?? {
      mode: 'light',
      appsUseLightTheme: true,
      systemUsesLightTheme: true,
      wallpaperColor: null,
    });
  }

  function scheduleSystemThemeRefresh(force = false) {
    applyCachedSystemTheme();

    if (systemThemeRefreshTask) return;
    if (systemThemeRefreshTimer !== null) {
      if (!force) return;
      window.clearTimeout(systemThemeRefreshTimer);
      systemThemeRefreshTimer = null;
    }

    systemThemeRefreshTimer = window.setTimeout(() => {
      systemThemeRefreshTimer = null;
      systemThemeRefreshTask = refreshSystemTheme().finally(() => {
        systemThemeRefreshTask = null;
      });
    }, force ? 0 : 240);
  }

  function refreshSystemThemeOnFocus() {
    if (settings.value.theme !== 'wallpaperTone') return;

    const now = Date.now();
    if (now - lastSystemThemeRefreshRequestedAt < 2_000) return;

    lastSystemThemeRefreshRequestedAt = now;
    scheduleSystemThemeRefresh(true);
  }

  async function refreshSystemTheme() {
    try {
      const state = await getSystemThemeState();
      cachedSystemThemeState.value = { state, savedAt: Date.now() };
      writeCachedSystemThemeState(state);
      applySystemThemeState(state);
    } catch {
      applyCachedSystemTheme();
    }
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
      void setRustBackendQueue(
        queue.value,
        currentTrack.value?.path ?? null,
        playbackMode.value,
        settings.value.seamlessPlayback,
        settings.value.crossfadePlayback,
        3000,
      ).catch((err) => {
        error.value = getErrorMessage(err);
      });
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
    const title = name.trim();
    if (!title) return false;
    if (settings.value.playlists.some((playlist) => playlist.name.trim() === title)) {
      return false;
    }

    const trackIds = initialTracks.map((track) => (typeof track === 'number' ? track : track.id));
    const snapshots = initialTracks
      .filter((track): track is Track => typeof track !== 'number' && !tracks.value.some((item) => item.id === track.id))
      .map((track) => createFavoriteTrackSnapshot(track));

    settings.value.playlists = [
      ...settings.value.playlists,
      {
        id: `playlist-${Date.now()}`,
        name: title,
        trackIds,
        tracks: snapshots,
        createdAt: Date.now(),
      },
    ];
    persistSettings();
    return true;
  }

  function renamePlaylist(playlistId: string, name: string) {
    const title = name.trim();
    if (!title) return false;
    if (settings.value.playlists.some((playlist) => playlist.id !== playlistId && playlist.name.trim() === title)) {
      return false;
    }

    let renamed = false;
    settings.value.playlists = settings.value.playlists.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      renamed = true;
      return { ...playlist, name: title };
    });

    if (renamed) {
      persistSettings();
    }

    return renamed;
  }

  function deletePlaylist(playlistId: string) {
    const nextPlaylists = settings.value.playlists.filter((playlist) => playlist.id !== playlistId);
    if (nextPlaylists.length === settings.value.playlists.length) return false;

    settings.value.playlists = nextPlaylists;
    persistSettings();
    return true;
  }

  function addTrackToPlaylist(track: Track, playlistId: string) {
    let added = false;

    settings.value.playlists = settings.value.playlists.map((playlist) => {
      if (playlist.id !== playlistId || playlist.trackIds.includes(track.id)) {
        return playlist;
      }

      added = true;
      const snapshots = playlist.tracks ?? [];
      const shouldStoreSnapshot = !tracks.value.some((item) => item.id === track.id);
      return {
        ...playlist,
        trackIds: [track.id, ...playlist.trackIds.filter((id) => id !== track.id)],
        tracks: shouldStoreSnapshot
          ? [createFavoriteTrackSnapshot(track), ...snapshots.filter((item) => item.id !== track.id)]
          : snapshots,
      };
    });

    if (added) {
      persistSettings();
    }

    return added;
  }

  function removeTrackFromPlaylist(track: Track, playlistId: string) {
    let removed = false;

    settings.value.playlists = settings.value.playlists.map((playlist) => {
      if (playlist.id !== playlistId || !playlist.trackIds.includes(track.id)) {
        return playlist;
      }

      removed = true;
      return {
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== track.id),
        tracks: (playlist.tracks ?? []).filter((item) => item.id !== track.id),
      };
    });

    if (removed) {
      persistSettings();
    }

    return removed;
  }

  applySettingsSideEffects();
  void listen<SystemThemeState>('system-theme-changed', (event) => {
    writeCachedSystemThemeState(event.payload);
    applySystemThemeState(event.payload);
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
    play,
    setCurrentTrack,
    playQueue,
    persistPlaybackSession,
    restorePlaybackSession,
    queueNext,
    queueLast,
    playNext,
    playPrevious,
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
