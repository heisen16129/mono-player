<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import AppDialogs from './components/AppDialogs.vue';
import AppMainContent from './components/AppMainContent.vue';
import PlaylistContextMenu from './components/PlaylistContextMenu.vue';
import LyricsView from './components/LyricsView.vue';
import PlayerDock from './components/PlayerDock.vue';
import TrackContextMenu from './components/TrackContextMenu.vue';
import WindowControls from './components/WindowControls.vue';
import { useActiveTrackState } from './composables/useActiveTrackState';
import { useDownloadState } from './composables/useDownloadState';
import { useLibraryNavigation } from './composables/useLibraryNavigation';
import { useLibraryPanelResize } from './composables/useLibraryPanelResize';
import { useLyricsDockAutoHide } from './composables/useLyricsDockAutoHide';
import { useLyricsState } from './composables/useLyricsState';
import { useOnlineSearch } from './composables/useOnlineSearch';
import { useOnlineQualityRefresh } from './composables/useOnlineQualityRefresh';
import { useOnlineToast } from './composables/useOnlineToast';
import { usePlaybackSession } from './composables/usePlaybackSession';
import { usePlaylistActions } from './composables/usePlaylistActions';
import { useScanFolders } from './composables/useScanFolders';
import { useSearchHistory } from './composables/useSearchHistory';
import { useSidebarCollapse } from './composables/useSidebarCollapse';
import { useTrackMetadataDialog } from './composables/useTrackMetadataDialog';
import { useTrayIntegration } from './composables/useTrayIntegration';
import { resolveLocale, t } from './i18n';
import {
  DESKTOP_LYRICS_ACTION_EVENT,
  DESKTOP_LYRICS_READY_EVENT,
  broadcastDesktopLyricsState,
  openDesktopLyricsWindow,
  type DesktopLyricsAction,
} from './services/desktopLyrics';
import { deleteDownloadedTrackFile, enqueueDownloadOnlineTrack, openDownloadedTrackInFolder, type DownloadOnlineTrackRequest, type DownloadQueueEvent } from './services/downloads';
import { exitApp, isTauriRuntime, resolveLocalTrackLyrics } from './services/music';
import { getPluginLyricsMetadata } from './services/pluginSearch';
import { changeRustBackendQueueTrackQuality, getRustBackendDefaultCacheDir, listenRustBackendQueue, playRustBackendNext, playRustBackendPrevious, removeRustBackendQueueSource, restoreRustBackendQueue, setRustBackendCacheDir, setRustBackendPlaybackMode, startRustBackendQueue, stopRustBackend, type RustQueueSnapshot } from './services/playerBackend';
import { clearSystemMedia, listenSystemMediaAction, updateSystemMedia, type SystemMediaAction } from './services/systemMedia';
import { usePlayerStore } from './stores/player';
import type { DownloadItem, PlaybackMode, Track, TrackLyrics } from './types/music';
import type { PluginPlaybackQuality, PluginSearchTrack } from './types/plugin';
import { getErrorMessage } from './utils/error';
import {
  buildOnlinePlaybackQueue as buildOnlinePlaybackQueueFromTracks,
  createOnlineQueueTrack,
  findPluginTrackForQueueTrack as findPluginTrackForQueueTrackFromCandidates,
  isSameOnlineTrackIdentity,
} from './utils/onlineTrack';
import { folderTitle, normalizePath } from './utils/path';
import { normalizeTrackLyrics, selectTrackLyricsVariant } from './utils/trackLyrics';
import { pluginSearchTrackKey, positiveStableStringHash } from './utils/trackKey';
import { shouldSkipWindowDrag } from './utils/windowDrag';

const player = usePlayerStore();
const isAppReady = ref(false);
const { isSidebarCollapsed } = useSidebarCollapse();
const isLyricsOpen = ref(false);
const isLyricsTransitioning = ref(false);
const isLibraryVisible = ref(true);
const togglePlaybackRequestId = ref(0);
const playbackTime = ref(0);
const isAudioPlaying = ref(false);
const playbackSpectrumLevels = ref<number[]>([]);
const seekRequestId = ref(0);
const seekTime = ref(0);
type SleepTimerAction = 'stop' | 'exit' | 'finishTrack';
interface McpSleepTimerRequest {
  minutes: number;
  action: SleepTimerAction | null;
}
const {
  clearOnlineToastTimer,
  closeOnlineToast,
  onlineToastMessage,
  onlineToastVariant,
  showOnlineToast,
} = useOnlineToast();
const sleepTimerRequestId = ref(0);
const sleepTimerRequest = ref<McpSleepTimerRequest | null>(null);
const RUST_CROSSFADE_DURATION_MS = 3000;
let desktopLyricsActionUnlisten: UnlistenFn | null = null;
let desktopLyricsReadyUnlisten: UnlistenFn | null = null;
let downloadEventUnlisten: UnlistenFn | null = null;
let mcpSleepTimerUnlisten: UnlistenFn | null = null;
let rustQueueUnlisten: UnlistenFn | null = null;
let systemMediaUnlisten: UnlistenFn | null = null;
let lastSystemMediaSyncKey = '';
let lastSystemMediaSyncAt = 0;
const localLyricsRequests = new Map<string, Promise<TrackLyrics | null>>();
const onlineLyricsRequests = new Map<string, Promise<void>>();
const selectedLyricFormatByTrackKey = ref(new Map<string, string>());
const startupLoadingText = computed(() => (resolveLocale(player.settings.locale) === 'en-US' ? 'Loading music library...' : '正在加载音乐库...'));

const searchHistoryLimit = computed(() => Math.max(1, Math.round(player.settings.searchHistoryLimit)));
const localLyricsMetadataByKey = ref(new Map<string, TrackLyrics>());
const {
  loadSearchHistory,
  saveSearchHistory,
  searchHistory,
} = useSearchHistory(searchHistoryLimit);
const {
  appGridStyle,
  isResizingLibraryPanel,
  loadLibraryPanelWidth,
  startLibraryPanelResize,
} = useLibraryPanelResize();
const shouldShowLibraryResizeHandle = computed(() => {
  if (activeView.value === 'artists') return true;
  return activeView.value === 'library' && activeCollection.value === 'all' && isLibraryPanelMode.value;
});
const {
  downloadItems,
  downloadedTrackKeys,
  handleDownloadQueueEvent: applyDownloadQueueEvent,
  isTrackDownloaded,
  isTrackDownloadPending,
  loadDownloadItems,
  pendingDownloadTrackKeys,
  persistDownloadItems,
  updateDownloadItem,
} = useDownloadState();
const {
  activeOnlineProviderId,
  closeOnlineSearchState,
  isOnlineLoadingMore,
  isOnlineSearching,
  isOnlineSearchOpen,
  loadMoreOnlineMusic,
  onlineLoadMoreError,
  onlineSearchError,
  onlineSearchHasMore,
  onlineSearchProviders,
  onlineSearchQuery,
  onlineSearchResults,
  runOnlineSearch,
  selectOnlineProvider,
} = useOnlineSearch({
  loadMoreErrorFallback: () => (resolveLocale(player.settings.locale) === 'en-US' ? 'Failed to load more results.' : '加载更多失败'),
  normalizeErrorMessage: normalizeOnlineErrorMessage,
  onError: showOnlineToast,
  searchErrorFallback: () => (resolveLocale(player.settings.locale) === 'en-US' ? 'Plugin search failed.' : '插件搜索失败'),
  trackKey: getOnlineTrackKey,
});
const shouldShowDownloadsMenu = computed(() => player.settings.enablePlugins || downloadItems.value.length > 0);

function normalizePlaybackQueuePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/\/\?\//, '').toLocaleLowerCase();
}

function dedupePlaybackQueue(tracks: Track[]) {
  const seenPaths = new Set<string>();
  return tracks.filter((track) => {
    const path = normalizePlaybackQueuePath(track.path);
    if (!path || seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  });
}

function mergeTrackRuntimeMetadata(track: Track, candidates: Track[]) {
  const existing = candidates.find((item) => item.id === track.id || normalizePath(item.path) === normalizePath(track.path));
  if (!existing) return track;
  return {
    ...track,
    lyrics: track.lyrics ?? existing.lyrics ?? null,
    associatedLyrics: track.associatedLyrics ?? existing.associatedLyrics ?? null,
    associatedArtwork: track.associatedArtwork ?? existing.associatedArtwork ?? null,
    artwork: track.artwork ?? existing.artwork ?? null,
  };
}

function mergeQueueRuntimeMetadata(tracks: Track[]) {
  const candidates = [
    ...rustPlaybackQueue.value,
    ...(onlineActiveTrack.value ? [onlineActiveTrack.value] : []),
    ...(player.currentTrack ? [player.currentTrack] : []),
    ...(selectedTrack.value ? [selectedTrack.value] : []),
  ];
  return tracks.map((track) => mergeTrackRuntimeMetadata(track, candidates));
}

function localLyricsRequestKey(track: Track) {
  return normalizePath(track.path);
}

function selectedLyricTrackKey(track: Track | null) {
  return lyricsTrackKey(track) ?? '';
}

function setSelectedLyricFormat(track: Track | null, format: string | null) {
  const key = selectedLyricTrackKey(track);
  if (!key || !format) return;
  const nextFormats = new Map(selectedLyricFormatByTrackKey.value);
  nextFormats.set(key, format);
  selectedLyricFormatByTrackKey.value = nextFormats;
}

function selectedLyricFormatForTrack(track: Track | null, lyrics: TrackLyrics | null | undefined) {
  const formats = lyrics?.lyrics.map((variant) => variant.format) ?? [];
  const key = selectedLyricTrackKey(track);
  const selectedFormat = key ? selectedLyricFormatByTrackKey.value.get(key) : null;
  if (selectedFormat && formats.includes(selectedFormat)) return selectedFormat;
  const defaultFormat = lyrics?.defaultFormat?.trim().toLowerCase() ?? null;
  if (defaultFormat && formats.includes(defaultFormat)) return defaultFormat;
  return formats[0] ?? null;
}

function cacheLocalTrackLyrics(track: Track, lyrics: TrackLyrics) {
  const nextCache = new Map(localLyricsMetadataByKey.value);
  nextCache.set(localLyricsRequestKey(track), lyrics);
  localLyricsMetadataByKey.value = nextCache;
}

function findKnownTrackLyrics(track: Track) {
  const candidates = [
    player.currentTrack,
    selectedTrack.value,
    ...rustPlaybackQueue.value,
    ...player.queue,
    ...player.tracks,
  ].filter((item): item is Track => Boolean(item));
  const existing = candidates.find((item) => item.id === track.id || normalizePath(item.path) === normalizePath(track.path));
  const lyrics = normalizeTrackLyrics(existing);
  return lyrics?.lyrics.length ? lyrics : null;
}

const allVisibleTracks = computed(() => {
  return player.filteredTracks;
});

const folderVisibleTracks = computed(() => {
  if (!activeFolderPath.value) return allVisibleTracks.value;

  const normalizedFolder = normalizePath(activeFolderPath.value);
  return allVisibleTracks.value.filter((track) => {
    return normalizePath(track.path).startsWith(`${normalizedFolder}/`);
  });
});

const recentAddedVisibleTracks = computed(() => {
  const visibleTrackIds = new Set(allVisibleTracks.value.map((track) => track.id));
  return player.latestAddedTracks.filter((track) => visibleTrackIds.has(track.id));
});

const recentPlayedVisibleTracks = computed(() => {
  const trackById = new Map(allVisibleTracks.value.map((track) => [track.id, track]));
  return player.settings.recentPlayedTrackIds
    .map((id) => trackById.get(id))
    .filter((track): track is Track => Boolean(track));
});

const artistGroups = computed(() => {
  const groups = new Map<string, Track[]>();
  const artistNameCollator = new Intl.Collator('zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base',
  });

  for (const track of allVisibleTracks.value) {
    const artist = track.artist?.trim() || t(player.settings.locale, 'unknownArtist');
    const tracks = groups.get(artist) ?? [];
    tracks.push(track);
    groups.set(artist, tracks);
  }

  return [...groups.entries()]
    .map(([name, tracks]) => ({
      name,
      tracks: tracks.sort((left, right) => left.title.localeCompare(right.title, 'zh-Hans-CN')),
    }))
    .sort((left, right) => {
      const countDifference = right.tracks.length - left.tracks.length;
      if (countDifference !== 0) return countDifference;
      return artistNameCollator.compare(left.name, right.name);
    });
});

const {
  activeArtistName,
  activeCollection,
  activeFolderPath,
  activeLibraryFilter,
  activePlaylistId,
  activeView,
  isLibraryPanelMode,
  openArtistFromTrack,
  openArtistsView,
  openDiscoverView,
  openDownloadsView,
  openFavoritesView,
  openFolder,
  openLibraryView,
  openPlaylistView,
  openPluginsView,
  openRecentAdded,
  openRecentAddedInLibrary,
  openRecentPlayed,
  openSettingsView,
  openThemeView,
  selectArtist,
} = useLibraryNavigation(artistGroups);

const {
  addToPlaylistTrack,
  addTrackToPlaylist,
  closeAddToPlaylistDialog,
  closeContextMenus,
  closeCreatePlaylistDialog,
  confirmCreatePlaylist,
  deletePlaylist,
  editingPlaylistId,
  isPlaylistDialogOpen,
  newPlaylistName,
  openAddToPlaylistDialog,
  openCreatePlaylistDialog,
  openCreatePlaylistFromAddDialog,
  openPlaylistContextMenu,
  openTrackContextMenu,
  openTrackFolder,
  playlistContextMenu,
  queueTrackLast,
  queueTrackNext,
  removeTrackFromActivePlaylist,
  startRenamePlaylist,
  trackContextMenu,
  tracksForPlaylist,
} = usePlaylistActions({
  activePlaylistId,
  onQueueSnapshot: (snapshot) => {
    handleRustQueueSnapshot(snapshot);
  },
  openLibraryView,
  player,
});

const visibleTracks = computed(() => {
  if (activePlaylistId.value) {
    const playlist = player.settings.playlists.find((item) => item.id === activePlaylistId.value);
    const localTrackById = new Map(allVisibleTracks.value.map((track) => [track.id, track]));
    const snapshotById = new Map((playlist?.tracks ?? []).map((track) => [track.id, track]));
    return (playlist?.trackIds ?? [])
      .map((id) => localTrackById.get(id) ?? snapshotById.get(id))
      .filter((track): track is Track => Boolean(track));
  }

  if (activeCollection.value === 'favorites') {
    return player.favoriteTracks;
  }

  if (activeLibraryFilter.value === 'recentAdded') {
    return recentAddedVisibleTracks.value;
  }

  if (activeLibraryFilter.value === 'recentPlayed') {
    return recentPlayedVisibleTracks.value;
  }

  return folderVisibleTracks.value;
});

const {
  activeTrack,
  currentPlaybackSource,
  currentPlaybackTrack,
  isPreparingActiveTrack,
  onlineActivePluginTrack,
  onlineActiveTrack,
  onlineActiveTrackKey,
  onlinePlaybackSource,
  onlinePreparingTrackKey,
  onlineResolvingTrackKey,
  queueSwitchingTrackKey,
  rustPlaybackQueue,
  selectedTrack,
  shouldShowOnlineQuality,
} = useActiveTrackState({
  currentSource: computed(() => player.currentSource),
  isRemoteTrack,
  visibleTracks,
});

const {
  onlinePlaybackQuality,
  onlinePlaybackQualityOptions,
} = useOnlineQualityRefresh({
  activePluginTrack: onlineActivePluginTrack,
  trackKey: getOnlineTrackKey,
});

const {
  hoverLyricsDock,
  isLyricsDockHidden,
  leaveLyricsDock,
  shouldAutoHideLyricsDock,
} = useLyricsDockAutoHide({
  activeTrack,
  autoHideEnabled: computed(() => player.settings.autoHideLyricsDock),
  isAudioPlaying,
  isLyricsOpen,
});

const {
  activeLyricsViewStatus,
  hasTrackSourceLyrics,
  lyricsTrackKey,
  lyricsViewState,
  setLyricsViewState,
  syncLyricsViewStateForTrack,
  updateLyricsViewStateForRequest,
} = useLyricsState(activeTrack);
const playbackLyricMetadata = computed(() => {
  const active = activeTrack.value;
  const lyrics = normalizeTrackLyrics(active);
  if (lyrics) return lyrics;
  if (!active || isRemoteTrack(active)) return null;
  return localLyricsMetadataByKey.value.get(localLyricsRequestKey(active)) ?? null;
});
const playbackLyricFormats = computed(() => {
  const formats = playbackLyricMetadata.value?.lyrics.map((variant) => variant.format) ?? [];
  return formats.filter((format, index) => format && formats.indexOf(format) === index);
});
const playbackLyricFormat = computed(() => {
  return selectedLyricFormatForTrack(activeTrack.value, playbackLyricMetadata.value);
});
const playbackLyricVariant = computed(() => selectTrackLyricsVariant(playbackLyricMetadata.value, playbackLyricFormat.value));
const shouldShowLyricFormat = computed(() => {
  const active = activeTrack.value;
  return Boolean(
    playbackLyricFormats.value.length > 1
    && active
    && (findPluginTrackForQueueTrack(active) || !isRemoteTrack(active)),
  );
});
const shouldShowActiveTrackDownload = computed(() => Boolean(player.settings.enablePlugins && onlineActiveTrack.value && onlineActivePluginTrack.value));
const isActiveOnlineTrackDownloaded = computed(() => (
  onlineActiveTrack.value ? isTrackDownloaded(onlineActiveTrack.value) : false
));
const isActiveOnlineTrackDownloading = computed(() => (
  onlineActiveTrack.value ? isTrackDownloadPending(onlineActiveTrack.value) : false
));
const canUseLocalTrackContextActions = computed(() => (
  activeView.value === 'library'
  && activeCollection.value === 'all'
  && !activePlaylistId.value
  && activeLibraryFilter.value !== 'recentAdded'
  && activeLibraryFilter.value !== 'recentPlayed'
));
const canEditTrackMetadata = computed(() => canUseLocalTrackContextActions.value && player.settings.enableTrackMetadataEdit);
const canChangeTrackCover = computed(() => canUseLocalTrackContextActions.value && player.settings.enableTrackCoverEdit);
const canRefreshTrackDuration = computed(() => canUseLocalTrackContextActions.value && player.settings.enableTrackDurationRefresh);

const {
  applyTrackCoverRefresh,
  changeTrackCover,
  closeTrackMetadataDialog,
  isSavingTrackMetadata,
  metadataEditingTrack,
  openTrackMetadataDialog,
  refreshLocalTrackDuration,
  saveTrackMetadata,
  trackMetadataError,
} = useTrackMetadataDialog({
  canChangeTrackCover,
  canEditTrackMetadata,
  canRefreshTrackDuration,
  closeContextMenus,
  currentPlaybackTrack,
  onlineActiveTrack,
  player,
  rustPlaybackQueue,
  selectedTrack,
  showToast: showOnlineToast,
});

watch(
  () => player.settings.enablePlugins,
  (enabled) => {
    if (enabled || !['discover', 'plugins'].includes(activeView.value)) return;
    returnToLocalLibrary();
  },
);

watch(
  shouldShowDownloadsMenu,
  (visible) => {
    if (visible || activeView.value !== 'downloads') return;
    returnToLocalLibrary();
  },
);

watch(
  () => [
    activeTrack.value,
    playbackTime.value,
    isAudioPlaying.value,
    player.settings.useThemeLyricColor,
    player.settings.lyricFontColor,
    player.settings.theme,
  ] as const,
  () => {
    void broadcastCurrentDesktopLyricsState();
  },
  { immediate: true },
);

watch(
  () => [
    activeTrack.value,
    playbackTime.value,
    isAudioPlaying.value,
  ] as const,
  () => {
    void syncSystemMediaState();
  },
  { immediate: true },
);

watch(
  () => [lyricsTrackKey(activeTrack.value), normalizeTrackLyrics(activeTrack.value)?.lyrics.length ?? 0] as const,
  ([trackKey, lyricsCount], previousValue) => {
    const previousTrackKey = previousValue?.[0] ?? null;
    if (trackKey !== previousTrackKey) {
      syncLyricsViewStateForTrack(activeTrack.value);
      return;
    }
    if (lyricsCount > 0) {
      setLyricsViewState(activeTrack.value, 'ready');
    }
  },
  { immediate: true },
);

watch(
  () => [activeTrack.value?.id, activeTrack.value?.path, Boolean(onlineActiveTrack.value)] as const,
  ([, , isOnlineTrack]) => {
    const track = activeTrack.value;
    if (!track || isOnlineTrack || isRemoteTrack(track)) return;
    void loadLocalTrackLyricsInBackground(track);
  },
  { immediate: true },
);

function resolveDesktopLyricColor() {
  if (!player.settings.useThemeLyricColor) {
    return player.settings.lyricFontColor;
  }

  return getComputedStyle(document.documentElement)
    .getPropertyValue('--smw-lyrics-current')
    .trim() || player.settings.lyricFontColor;
}

async function broadcastCurrentDesktopLyricsState() {
  await broadcastDesktopLyricsState({
    track: activeTrack.value,
    lyricContent: playbackLyricVariant.value?.content ?? null,
    lyricFormat: playbackLyricVariant.value?.format ?? null,
    currentTime: playbackTime.value,
    isPlaying: isAudioPlaying.value,
    lyricColor: resolveDesktopLyricColor(),
  });
}

async function syncSystemMediaState() {
  if (!isTauriRuntime()) return;

  const track = activeTrack.value;
  if (!track) {
    await clearSystemMedia().catch(() => {});
    return;
  }

  const roundedPosition = Math.max(0, Math.round(playbackTime.value * 10) / 10);
  const syncKey = [
    track.id,
    track.title,
    track.artist ?? '',
    track.album ?? '',
    track.artwork ?? '',
    track.duration ?? '',
    isAudioPlaying.value ? 'playing' : 'paused',
    Math.floor(roundedPosition),
  ].join('|');

  const now = Date.now();
  if (syncKey === lastSystemMediaSyncKey && now - lastSystemMediaSyncAt < 1000) return;
  lastSystemMediaSyncKey = syncKey;
  lastSystemMediaSyncAt = now;

  await updateSystemMedia({
    title: track.title || 'Mono Player',
    artist: track.artist,
    album: track.album,
    artwork: normalizeSystemMediaArtwork(track.artwork),
    trackPath: track.path,
    duration: track.duration,
    position: roundedPosition,
    isPlaying: isAudioPlaying.value,
  }).catch(() => {});
}

function normalizeSystemMediaArtwork(artwork: string | null | undefined) {
  if (!artwork || artwork.startsWith('blob:')) return null;
  return artwork;
}

function isLocalLibraryTrack(track: Track) {
  return track.id > 0 && !/^[a-z][a-z0-9+.-]*:\/\//i.test(track.path);
}

async function pruneRemovedLocalTracksFromQueue() {
  const libraryTrackKeys = new Set(player.tracks.map((track) => `${track.id}:${normalizePath(track.path)}`));
  const removedTracks: Track[] = [];
  const nextQueue = rustPlaybackQueue.value.filter((track) => {
    if (!isLocalLibraryTrack(track)) return true;
    const exists = libraryTrackKeys.has(`${track.id}:${normalizePath(track.path)}`);
    if (!exists) removedTracks.push(track);
    return exists;
  });

  if (removedTracks.length === 0) return;

  rustPlaybackQueue.value = nextQueue;
  for (const track of removedTracks) {
    try {
      handleRustQueueSnapshot(await removeRustBackendQueueSource(queueSourceKey(track)));
    } catch (error) {
      showOnlineToast(getErrorMessage(error));
    }
  }
}

watch(
  () => player.tracks.map((track) => `${track.id}:${track.path}`).join('|'),
  () => {
    void pruneRemovedLocalTracksFromQueue();
  },
);

function queueSourceKey(track: Track) {
  const providerId = track.sourceProviderId?.trim();
  const sourceId = track.sourceId?.trim();
  if (providerId && sourceId) return `plugin://${providerId}/${sourceId}`;
  return track.path;
}

function isSameTrackForMetadata(track: Track | null | undefined, target: Track) {
  if (!track) return false;
  const trackSourceKey = queueSourceKey(track).trim();
  const targetSourceKey = queueSourceKey(target).trim();
  if (trackSourceKey && targetSourceKey) {
    return normalizePath(trackSourceKey) === normalizePath(targetSourceKey);
  }
  return track.id === target.id;
}

function onlineTrackKeyForQueueTrack(track: Track) {
  const pluginTrack = findPluginTrackForQueueTrack(track);
  return pluginTrack ? getOnlineTrackKey(pluginTrack) : null;
}

function clearQueueSwitchingForTrack(track: Track | null) {
  if (!track || queueSwitchingTrackKey.value !== onlineTrackKeyForQueueTrack(track)) return;
  queueSwitchingTrackKey.value = null;
}

const {
  restorePlaybackRequestId,
  restorePlaybackTime,
  restoreSavedPlaybackSession,
  savePlaybackSessionNow,
} = usePlaybackSession({
  activeTrack,
  playbackQueue: rustPlaybackQueue,
  playbackTime,
  player,
  selectedTrack,
});


const libraryMeta = computed(() => {
  const totalSeconds = visibleTracks.value.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  return {
    count: visibleTracks.value.length,
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
  };
});

const isActiveTrackFavorite = computed(() => player.isFavorite(activeTrack.value));
const hasThemeBackground = computed(() => {
  return player.customThemes.some((theme) => theme.id === player.settings.theme && Boolean(theme.background));
});
const folderTones = ['desk', 'night', 'mist', 'road'] as const;

const localFolders = computed(() => {
  return player.settings.musicDirs
    .map((path) => {
      const normalizedFolder = normalizePath(path);
      const tracks = player.tracks.filter((track) => {
        const normalizedTrackPath = normalizePath(track.path);
        return normalizedTrackPath.startsWith(`${normalizedFolder}/`);
      });

      return {
        path,
        title: folderTitle(path),
        count: tracks.length,
        tracks,
      };
    })
    .filter((folder) => folder.count > 0)
    .map((folder, index) => ({
      ...folder,
      tone: folderTones[index % folderTones.length],
    }));
});

const localFolderTrackCount = computed(() => {
  return localFolders.value.reduce((sum, folder) => sum + folder.count, 0);
});

const recentAddedTrackCount = computed(() => {
  return recentAddedVisibleTracks.value.length;
});

const libraryTitle = computed(() => {
  if (activePlaylistId.value) {
    return player.settings.playlists.find((playlist) => playlist.id === activePlaylistId.value)?.name ?? t(player.settings.locale, 'localLibrary');
  }
  if (activeLibraryFilter.value === 'recentAdded') return t(player.settings.locale, 'recentAdded');
  if (activeLibraryFilter.value === 'recentPlayed') return t(player.settings.locale, 'recentPlayed');
  if (!activeFolderPath.value) return t(player.settings.locale, 'localLibrary');
  return localFolders.value.find((folder) => folder.path === activeFolderPath.value)?.title ?? t(player.settings.locale, 'localFolder');
});


const {
  addScanFolder,
  cancelScanFolders,
  chooseFolder,
  closeScanDialog,
  confirmScanFolders,
  isCancelingScan,
  isConfirmingScan,
  isScanDialogOpen,
  openScanDialog,
  removeScanFolder,
  scanFolders,
  scanProgressText,
  updateScanFolderChecked,
} = useScanFolders({
  activeFolderPath,
  player,
});



async function startWindowDrag(event: PointerEvent) {
  if (!isTauriRuntime() || event.button !== 0 || event.clientY > 64 || shouldSkipWindowDrag(event.target)) {
    return;
  }

  await getCurrentWindow().startDragging();
}

async function initializeApp() {
  try {
    await player.hydratePersistedState();
    if (!player.settings.audioCacheDir) {
      const defaultCacheDir = await getRustBackendDefaultCacheDir();
      if (defaultCacheDir) {
        player.setAudioCacheDir(defaultCacheDir);
      }
    }
    await setRustBackendCacheDir(player.settings.audioCacheDir || null);
    await loadLibraryPanelWidth();
    await loadDownloadItems();
    await loadSearchHistory();
    await player.loadLibrary();
    const restored = restoreSavedPlaybackSession();
    if (restored) {
      await restoreRustPlaybackQueue(restored.track, restored.currentTime);
    } else {
      rustPlaybackQueue.value = dedupePlaybackQueue(player.queue.filter((track) => track.path));
    }
  } finally {
    isAppReady.value = true;
  }

  await startDesktopLyricsActionListener();
  await startDesktopLyricsReadyListener();
  await startDownloadEventListener();
  await startMcpSleepTimerListener();
  await startRustQueueEventListener();
  await startSystemMediaActionListener();
}

onMounted(() => {
  void initializeApp().catch((error) => {
    player.error = getErrorMessage(error);
    isAppReady.value = true;
  });
});

onBeforeUnmount(() => {
  clearOnlineToastTimer();
  downloadEventUnlisten?.();
  downloadEventUnlisten = null;
  mcpSleepTimerUnlisten?.();
  mcpSleepTimerUnlisten = null;
  desktopLyricsActionUnlisten?.();
  desktopLyricsActionUnlisten = null;
  desktopLyricsReadyUnlisten?.();
  desktopLyricsReadyUnlisten = null;
  rustQueueUnlisten?.();
  rustQueueUnlisten = null;
  systemMediaUnlisten?.();
  systemMediaUnlisten = null;
});

watch(
  () => player.error,
  (message) => {
    if (!message) return;
    showOnlineToast(message);
    player.error = null;
  },
);

function isRemoteTrack(track: Track) {
  return track.path.startsWith('plugin://') || /^https?:\/\//i.test(track.path);
}

function normalizeOnlineErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  if (
    message === 'Plugin for selected track is not installed.'
    || message === '插件未安装或已停用，无法播放当前在线歌曲。'
  ) {
    return resolveLocale(player.settings.locale) === 'en-US'
      ? 'The plugin for this track is not installed or enabled. Open Plugin Manager and enable it before playing.'
      : '插件未安装或已停用，请到插件管理安装/启用后再播放。';
  }
  return message || fallback;
}

function isPlaybackRequestReplacedError(error: unknown) {
  return getErrorMessage(error).includes('Playback request was replaced.');
}

function normalizePlaybackErrorMessage(error: unknown, fallback = '播放失败') {
  const message = getErrorMessage(error, fallback);
  if (message.includes('No next queue source')) {
    return '没有下一首可播放';
  }
  return message || fallback;
}

async function startDownloadEventListener() {
  if (!isTauriRuntime() || downloadEventUnlisten) return;
  downloadEventUnlisten = await listen<DownloadQueueEvent>('download://event', (event) => {
    handleDownloadQueueEvent(event.payload);
  });
}

async function startDesktopLyricsActionListener() {
  if (!isTauriRuntime() || desktopLyricsActionUnlisten) return;
  desktopLyricsActionUnlisten = await listen<DesktopLyricsAction>(DESKTOP_LYRICS_ACTION_EVENT, async (event) => {
    await handleDesktopLyricsAction(event.payload);
  });
}

async function startDesktopLyricsReadyListener() {
  if (!isTauriRuntime() || desktopLyricsReadyUnlisten) return;
  desktopLyricsReadyUnlisten = await listen(DESKTOP_LYRICS_READY_EVENT, () => {
    void broadcastCurrentDesktopLyricsState();
  });
}

async function startRustQueueEventListener() {
  if (!isTauriRuntime() || rustQueueUnlisten) return;
  rustQueueUnlisten = await listenRustBackendQueue((snapshot) => {
    handleRustQueueSnapshot(snapshot);
  });
}

async function startMcpSleepTimerListener() {
  if (!isTauriRuntime() || mcpSleepTimerUnlisten) return;
  mcpSleepTimerUnlisten = await listen<{ minutes?: number; action?: string | null }>('mcp://sleep-timer', (event) => {
    const minutes = Math.min(999, Math.max(1, Math.round(Number(event.payload.minutes) || 0)));
    const action = event.payload.action;
    if (action === 'stop' || action === 'exit' || action === 'finishTrack') {
      player.setSleepTimerAction(action);
    }
    sleepTimerRequest.value = {
      minutes,
      action: action === 'stop' || action === 'exit' || action === 'finishTrack' ? action : null,
    };
    sleepTimerRequestId.value += 1;
    showOnlineToast(`已设置 ${minutes} 分钟后定时关闭`, 'success');
  });
}

async function startSystemMediaActionListener() {
  if (!isTauriRuntime() || systemMediaUnlisten) return;
  systemMediaUnlisten = await listenSystemMediaAction((action) => {
    void handleSystemMediaAction(action);
  });
}

function handleDownloadQueueEvent(event: DownloadQueueEvent) {
  const result = applyDownloadQueueEvent(event);
  if (result?.status === 'downloaded') {
    showOnlineToast(`下载完成：${result.item.title}`, 'success');
  }
  if (result?.status === 'failed') {
    showOnlineToast(`${result.item.title} 下载失败：${result.error}`);
  }
}

function selectTrack(track: Track) {
  selectedTrack.value = track;
}

function returnToLocalLibrary() {
  closeOnlineSearchState();
  onlineResolvingTrackKey.value = null;
  openLibraryView();
}

function openLocalFolderFromPanel(path: string) {
  closeOnlineSearchState();
  onlineResolvingTrackKey.value = null;
  openFolder(path);
}

function openRecentAddedFromPanel() {
  closeOnlineSearchState();
  onlineResolvingTrackKey.value = null;
  openRecentAddedInLibrary();
}

async function searchOnlineMusic(keyword: string, providerId?: string | null) {
  if (!player.settings.enablePlugins) {
    showOnlineToast(resolveLocale(player.settings.locale) === 'en-US' ? 'Enable plugins before using online music.' : '请先启用插件。');
    return;
  }

  const query = keyword.trim();
  if (!query) return;
  const shouldStayInDiscover = activeView.value === 'discover';

  await saveSearchHistory(query);
  activeView.value = shouldStayInDiscover ? 'discover' : 'library';
  activeCollection.value = 'all';
  activeLibraryFilter.value = 'all';
  isLibraryPanelMode.value = !shouldStayInDiscover;
  activeFolderPath.value = null;
  activePlaylistId.value = null;
  activeArtistName.value = null;
  await runOnlineSearch(query, providerId);
}

function openDiscoverMusicView() {
  if (!player.settings.enablePlugins) return;
  openDiscoverView();
  closeOnlineSearchState();
  onlineResolvingTrackKey.value = null;
}

async function playOnlineTrack(track: PluginSearchTrack, startTime = 0, queueTracks?: Track[]) {
  const playbackTrack = withDownloadedPlaybackSource(createOnlineQueueTrack(track));
  const trackKey = getOnlineTrackKey(track);

  playbackTime.value = startTime;
  onlineSearchError.value = null;
  onlineResolvingTrackKey.value = trackKey;
  rustPlaybackQueue.value = buildOnlinePlaybackQueue(track, playbackTrack, queueTracks);

  try {
    player.error = null;
    if (await startRustPlaybackQueue(rustPlaybackQueue.value, playbackTrack, startTime)) {
      void loadPlaybackTrackLyricsInBackground(track, playbackTrack);
    }
  } catch (error) {
    const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Could not get playback URL.' : '无法获取播放地址');
    onlineSearchError.value = message;
    await handleOnlinePlaybackFailure(track, message);
  } finally {
    if (onlineResolvingTrackKey.value === trackKey) {
      onlineResolvingTrackKey.value = null;
    }
  }
}

function buildOnlinePlaybackQueue(sourceTrack: PluginSearchTrack, playbackTrack: Track, queueTracks?: Track[]) {
  return buildOnlinePlaybackQueueFromTracks(sourceTrack, playbackTrack, {
    queueTracks,
    searchResults: onlineSearchResults.value,
    findPluginTrack: findPluginTrackForQueueTrack,
    mapPlaybackTrack: withDownloadedPlaybackSource,
    dedupeTracks: dedupePlaybackQueue,
  });
}

async function handleOnlinePlaybackFailure(track: PluginSearchTrack, message: string) {
  onlinePlaybackSource.value = '';
  await stopRustBackend(false);
  isAudioPlaying.value = false;

  if (player.settings.onlinePlaybackFailureAction !== 'next') {
    showOnlineToast(message);
    return;
  }

  const nextTrack = findNextOnlineSearchTrack(track);
  if (!nextTrack) {
    showOnlineToast(`${message}，没有下一首可播放`);
    return;
  }

  showOnlineToast(`${message}，正在播放下一首`);
  await playOnlineTrack(nextTrack);
}

function findNextOnlineSearchTrack(track: PluginSearchTrack) {
  const trackKey = getOnlineTrackKey(track);
  const index = onlineSearchResults.value.findIndex((item) => getOnlineTrackKey(item) === trackKey);
  if (index < 0) return null;
  return onlineSearchResults.value[index + 1] ?? null;
}

function findPluginTrackForQueueTrack(track: Track) {
  return findPluginTrackForQueueTrackFromCandidates(track, {
    searchResults: onlineSearchResults.value,
    activePluginTrack: onlineActivePluginTrack.value,
  });
}

async function changeOnlinePlaybackQuality(quality: PluginPlaybackQuality) {
  const qualityOption = onlinePlaybackQualityOptions.value.find((option) => option.id === quality);
  if (qualityOption && !qualityOption.available) {
    console.warn('[plugin-playback] change online quality skipped', {
      requestedQuality: quality,
      reason: qualityOption.reason ?? 'quality unavailable',
    });
    return;
  }
  const previousQuality = onlinePlaybackQuality.value;
  onlinePlaybackQuality.value = quality;

  if (!onlineActivePluginTrack.value || !onlineActiveTrack.value) {
    console.warn('[plugin-playback] change online quality skipped', {
      requestedQuality: quality,
      reason: 'missing active online track',
    });
    return;
  }

  const track = onlineActivePluginTrack.value;
  const trackKey = getOnlineTrackKey(track);
  onlineResolvingTrackKey.value = trackKey;
  try {
    handleRustQueueSnapshot(await changeRustBackendQueueTrackQuality(quality, playbackTime.value));
  } catch (error) {
    console.warn('[plugin-playback] change online quality failed', {
      providerId: track.providerId,
      providerName: track.providerName,
      trackId: track.id,
      title: track.title,
      previousQuality,
      requestedQuality: quality,
      error,
    });
    const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Failed to switch quality.' : '切换音质失败');
    onlineSearchError.value = message;
    await handleOnlinePlaybackFailure(track, message);
  } finally {
    if (onlineResolvingTrackKey.value === trackKey) {
      onlineResolvingTrackKey.value = null;
    }
  }
}

async function changeLyricFormat(format: string) {
  const active = activeTrack.value;
  if (!active || format === playbackLyricFormat.value) return;
  const lyrics = playbackLyricMetadata.value;
  if (!lyrics?.lyrics.some((variant) => variant.format === format)) {
    showOnlineToast('这个歌词格式没有可用内容', 'error');
    return;
  }
  setSelectedLyricFormat(active, format);
}

async function loadOnlineTrackLyricsInBackground(track: PluginSearchTrack, playbackTrack: Track) {
  const trackKey = getOnlineTrackKey(track);
  if (hasTrackSourceLyrics(playbackTrack)) {
    updateLyricsViewStateForRequest(playbackTrack, 'ready');
    return;
  }
  const existing = onlineLyricsRequests.get(trackKey);
  if (existing) return existing;

  const request = (async () => {
    try {
      const lyrics = await getPluginLyricsMetadata(track);
      if (!lyrics.lyrics.length || onlineActiveTrackKey.value !== trackKey || activeTrack.value?.id !== playbackTrack.id) {
        if (onlineActiveTrackKey.value === trackKey && activeTrack.value?.id === playbackTrack.id) {
          updateLyricsViewStateForRequest(playbackTrack, 'empty');
        }
        return;
      }
      updateActiveTrackSourceLyrics(
        lyrics,
        playbackTrack.artwork ?? track.artwork ?? null,
        track.providerName,
        track.providerId,
        track.id,
        track.raw ?? track,
      );
      updateLyricsViewStateForRequest(playbackTrack, 'ready');
    } catch (error) {
      updateLyricsViewStateForRequest(playbackTrack, 'empty');
      console.warn('[plugin-lyrics] background lyrics load failed', {
        providerId: track.providerId,
        providerName: track.providerName,
        trackId: track.id,
        title: track.title,
        error,
      });
    } finally {
      onlineLyricsRequests.delete(trackKey);
    }
  })();

  onlineLyricsRequests.set(trackKey, request);
  return request;
}

function loadPlaybackTrackLyricsInBackground(track: PluginSearchTrack, playbackTrack: Track) {
  if (!isRemoteTrack(playbackTrack)) {
    void loadLocalTrackLyricsInBackground(playbackTrack);
    return;
  }
  void loadOnlineTrackLyricsInBackground(track, playbackTrack);
}

function requestLocalTrackLyrics(track: Track) {
  const key = localLyricsRequestKey(track);
  const existing = localLyricsRequests.get(key);
  if (existing) return existing;

  const request = resolveLocalTrackLyrics(track)
    .finally(() => {
      localLyricsRequests.delete(key);
    });
  localLyricsRequests.set(key, request);
  return request;
}

async function loadLocalTrackLyricsInBackground(track: Track) {
  const knownLyrics = findKnownTrackLyrics(track);
  if (knownLyrics) {
    cacheLocalTrackLyrics(track, knownLyrics);
    updateCurrentLocalTrackLyrics(track, knownLyrics);
    updateLyricsViewStateForRequest(track, 'ready');
    return;
  }

  try {
    const lyrics = await requestLocalTrackLyrics(track);
    if (!lyrics?.lyrics.length) {
      updateLyricsViewStateForRequest(track, 'empty');
      return;
    }
    cacheLocalTrackLyrics(track, lyrics);
    updateCurrentLocalTrackLyrics(track, lyrics);
    updateLyricsViewStateForRequest(track, 'ready');
  } catch (error) {
    updateLyricsViewStateForRequest(track, 'empty');
    console.warn('[local-lyrics] background lyrics load failed', {
      path: track.path,
      title: track.title,
      error,
    });
  }
}

function updateCurrentLocalTrackLyrics(track: Track, lyrics: TrackLyrics) {
  if (onlineActiveTrack.value && isRemoteTrack(onlineActiveTrack.value)) return;
  const current = player.currentTrack ?? selectedTrack.value;
  if (!current) return;
  const sameTrack = current.id === track.id || normalizePath(current.path) === normalizePath(track.path);
  if (!sameTrack) return;

  const nextTrack: Track = {
    ...current,
    lyrics,
    artwork: current.artwork ?? track.artwork ?? null,
  };
  player.setCurrentTrack(nextTrack);
  if (selectedTrack.value && (selectedTrack.value.id === track.id || normalizePath(selectedTrack.value.path) === normalizePath(track.path))) {
    selectedTrack.value = nextTrack;
  }
}

function getOnlineTrackKey(track: PluginSearchTrack) {
  return pluginSearchTrackKey(track);
}

function findDownloadedItemForQueueTrack(track: Track) {
  const sourceId = track.sourceId?.trim();
  if (!sourceId) return null;
  return downloadItems.value.find((item) => (
    item.sourceId === sourceId
    && (!track.sourceName || item.sourceName === track.sourceName)
    && item.status === 'downloaded'
    && Boolean(item.filePath)
  )) ?? null;
}

function withDownloadedPlaybackSource(track: Track) {
  const downloadedItem = findDownloadedItemForQueueTrack(track);
  if (!downloadedItem?.filePath) return track;
  return {
    ...track,
    path: downloadedItem.filePath,
    artwork: track.artwork ?? downloadedItem.artwork ?? null,
  };
}

function isDownloadedOnlineLocalPlaybackTrack(track: Track | null) {
  if (!track?.sourceProviderId || !track.sourceId || isRemoteTrack(track)) return false;
  const downloadedItem = findDownloadedItemForQueueTrack(track);
  return Boolean(downloadedItem?.filePath && normalizePath(downloadedItem.filePath) === normalizePath(track.path));
}

async function retryActiveDownloadedOnlineTrackFromPlugin(startPosition = 0) {
  const active = activeTrack.value;
  if (!isDownloadedOnlineLocalPlaybackTrack(active)) return false;

  const fallbackTrack: Track = {
    ...active,
    path: queueSourceKey(active),
  };
  const fallbackQueue = dedupePlaybackQueue((rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [active]).map((track) => (
    isSameOnlineTrackIdentity(track, active) ? fallbackTrack : track
  )));

  return startRustPlaybackQueue(fallbackQueue, fallbackTrack, startPosition);
}

async function startRustPlaybackQueue(tracks: Track[], requestedTrack: Track | null, startPosition = 0) {
  playbackTime.value = startPosition;
  const playbackTracks = dedupePlaybackQueue(tracks);
  try {
    const snapshot = await startRustBackendQueue(
      playbackTracks,
      requestedTrack?.path ?? null,
      player.playbackMode,
      player.settings.seamlessPlayback,
      player.settings.crossfadePlayback,
      RUST_CROSSFADE_DURATION_MS,
      startPosition,
    );
    handleRustQueueSnapshot(snapshot);
    return true;
  } catch (error) {
    if (isPlaybackRequestReplacedError(error)) return false;
    throw error;
  }
}

async function restoreRustPlaybackQueue(track: Track, currentTime: number) {
  const playbackTracks = dedupePlaybackQueue(player.queue.filter((item) => item.path));
  if (playbackTracks.length === 0) return;

  try {
    const snapshot = await restoreRustBackendQueue(
      playbackTracks,
      track.path || null,
      player.playbackMode,
      player.settings.seamlessPlayback,
      player.settings.crossfadePlayback,
      RUST_CROSSFADE_DURATION_MS,
    );
    handleRustQueueSnapshot(snapshot);
    playbackTime.value = currentTime;
    restorePlaybackTime.value = currentTime;
  } catch {
    rustPlaybackQueue.value = playbackTracks;
  }
}

async function playTrack(track: Track) {
  if (!track.path) {
    player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'This song has no local file path. Scan a music folder first.' : '这首歌没有本地文件路径，请先扫描音乐文件夹后再播放。';
    return;
  }

  player.error = null;
  await startRustPlaybackQueue(visibleTracks.value, track);
}

async function playFavoriteTracks() {
  const playableTracks = visibleTracks.value.filter((track) => track.path);
  if (playableTracks.length === 0) {
    player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'There is no playable local music in the current list.' : '当前列表里没有可播放的本地音乐。';
    return;
  }

  player.error = null;
  await startRustPlaybackQueue(playableTracks, null);
}

async function playQueueTrack(track: Track) {
  player.error = null;
  await startRustPlaybackQueue(rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [track], track);
}

function openOnlineTrackContextMenu(track: PluginSearchTrack, x: number, y: number) {
  openTrackContextMenu(createOnlineQueueTrack(track), x, y);
}

function createDownloadTrack(item: DownloadItem): Track {
  return {
    id: -positiveStableStringHash(`download:${item.id}`),
    path: item.filePath ?? '',
    title: item.title,
    artist: item.artist,
    album: item.album,
    duration: item.duration,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
  };
}

function queueDownloadedTrackNext(item: DownloadItem) {
  queueTrackNext(createDownloadTrack(item));
}

async function playDownloadedTrack(track: Track) {
  const queue = downloadItems.value
    .filter((item) => item.status === 'downloaded' && item.filePath)
    .map(createDownloadTrack);
  rustPlaybackQueue.value = dedupePlaybackQueue(queue.length > 0 ? queue : [track]);
  await startRustPlaybackQueue(rustPlaybackQueue.value, track);
}

async function queueTrackNextFromContext(track: Track) {
  const pluginTrack = findPluginTrackForQueueTrack(track);
  if (!pluginTrack) {
    await queueTrackNext(track);
    return;
  }

  closeContextMenus();
  await queueTrackNext(createOnlineQueueTrack(pluginTrack));
}

function addDownloadedTrackToPlaylist(item: DownloadItem) {
  openAddToPlaylistDialog(createDownloadTrack(item));
}

async function deleteDownloadedItem(item: DownloadItem) {
  if (item.filePath) {
    try {
      await deleteDownloadedTrackFile({
        filePath: item.filePath,
        lyricsPath: item.lyricsPath,
        downloadDir: player.settings.downloadDir,
        title: item.title,
        artist: item.artist,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      showOnlineToast(`删除失败：${message}`);
      return;
    }
  }

  downloadItems.value = downloadItems.value.filter((entry) => entry.id !== item.id);
  await persistDownloadItems();
  showOnlineToast(`已删除本地下载：${item.title}`, 'success');
}

async function clearDownloadedItemRecord(item: DownloadItem) {
  downloadItems.value = downloadItems.value.filter((entry) => entry.id !== item.id);
  await persistDownloadItems();
  showOnlineToast(`已清除下载记录：${item.title}`, 'success');
}

async function openDownloadedItemFolder(item: DownloadItem) {
  if (!isTauriRuntime()) return;

  try {
    await openDownloadedTrackInFolder({
      filePath: item.filePath,
      lyricsPath: item.lyricsPath,
      downloadDir: player.settings.downloadDir,
      title: item.title,
      artist: item.artist,
    });
  } catch (error) {
    player.error = getErrorMessage(error);
    showOnlineToast(player.error);
  }
}

function pauseDownloadItem(item: DownloadItem) {
  if (item.status !== 'downloading') return;
  updateDownloadItem(item.id, { status: 'paused', error: null });
  showOnlineToast(`已暂停：${item.title}`, 'success');
}

async function enqueueDownloadItemRequest(item: DownloadItem, actionLabel: string) {
  const request = item.downloadRequest;
  if (!request?.track) {
    showOnlineToast(`${item.title} 缺少下载信息，请重新从搜索结果下载`);
    return;
  }

  try {
    updateDownloadItem(item.id, { status: 'downloading', progress: Math.max(1, item.progress || 0), error: null });
    await enqueueDownloadOnlineTrack({ ...request, taskId: item.id } as DownloadOnlineTrackRequest);
    showOnlineToast(`${actionLabel}：${item.title}`, 'success');
  } catch (error) {
    const message = getErrorMessage(error, '下载失败');
    updateDownloadItem(item.id, { status: 'failed', error: message });
    showOnlineToast(`${item.title} ${actionLabel}失败：${message}`);
  }
}

async function retryDownloadItem(item: DownloadItem) {
  await enqueueDownloadItemRequest(item, '重试下载');
}

async function resumeDownloadItem(item: DownloadItem) {
  await enqueueDownloadItemRequest(item, '继续下载');
}

function downloadActiveOnlineTrack() {
  if (!onlineActiveTrack.value || !isRemoteTrack(onlineActiveTrack.value)) return;
  downloadTrack(onlineActiveTrack.value);
}

function downloadTrack(track: Track) {
  const sourceName = track.sourceName ?? '本地';
  const sourceId = track.sourceId ?? String(track.id);
  const itemId = `${sourceName}:${sourceId}`;
  if (downloadedTrackKeys.value.includes(itemId)) {
    closeContextMenus();
    showOnlineToast(`已下载：${track.title}`, 'success');
    return;
  }

  if (pendingDownloadTrackKeys.value.includes(itemId)) {
    closeContextMenus();
    showOnlineToast(`正在下载：${track.title}`, 'success');
    return;
  }

  const item: DownloadItem = {
    id: itemId,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    sourceName,
    sourceId,
    artwork: track.artwork ?? null,
    status: 'downloading',
    progress: 0,
    createdAt: Date.now(),
  };

  downloadItems.value = [item, ...downloadItems.value.filter((entry) => entry.id !== item.id)];
  void persistDownloadItems();
  closeContextMenus();

  if (!player.settings.downloadDir) {
    const message = '请先在设置中选择下载位置';
    updateDownloadItem(item.id, { status: 'failed', error: message });
    showOnlineToast(message);
    return;
  }

  showOnlineToast(`已添加到下载队列：${track.title}`, 'success');
  void prepareAndEnqueueDownload(track, item);
}

async function prepareAndEnqueueDownload(track: Track, item: DownloadItem) {
  try {
    const downloadRequest: DownloadOnlineTrackRequest = {
      taskId: item.id,
      downloadDir: player.settings.downloadDir,
      qualityFallback: player.settings.qualityFallback,
      track,
    };
    updateDownloadItem(item.id, { downloadRequest });
    await enqueueDownloadOnlineTrack(downloadRequest);
    updateDownloadItem(item.id, { status: 'downloading', progress: 1, error: null, downloadRequest });
  } catch (error) {
    const message = getErrorMessage(error, '下载失败');
    updateDownloadItem(item.id, { status: 'failed', error: message });
    showOnlineToast(`${track.title} 下载失败：${message}`);
  }
}

async function playPreviousTrack() {
  isAudioPlaying.value = false;
  try {
    handleRustQueueSnapshot(await playRustBackendPrevious());
  } catch (error) {
    if (isPlaybackRequestReplacedError(error)) return;
    queueSwitchingTrackKey.value = null;
    const message = normalizePlaybackErrorMessage(error, '切换上一首失败');
    player.error = null;
    showOnlineToast(message);
  }
}

async function playNextTrack() {
  isAudioPlaying.value = false;
  try {
    handleRustQueueSnapshot(await playRustBackendNext());
  } catch (error) {
    if (isPlaybackRequestReplacedError(error)) return;
    queueSwitchingTrackKey.value = null;
    const message = normalizePlaybackErrorMessage(error, '切换下一首失败');
    player.error = null;
    showOnlineToast(message);
  }
}

async function handlePlaybackFailure(message: string) {
  player.error = null;
  await stopRustBackend(false);
  isAudioPlaying.value = false;

  try {
    if (await retryActiveDownloadedOnlineTrackFromPlugin(playbackTime.value)) {
      return;
    }
  } catch (error) {
    message = normalizePlaybackErrorMessage(error, '在线源播放失败');
  }

  showOnlineToast(message);

  if (player.settings.onlinePlaybackFailureAction !== 'next') {
    return;
  }

  try {
    handleRustQueueSnapshot(await playRustBackendNext());
  } catch (error) {
    if (isPlaybackRequestReplacedError(error)) return;
    const nextMessage = normalizePlaybackErrorMessage(error, '没有下一首可播放');
    showOnlineToast(nextMessage);
  }
}

function handleSeamlessAdvance(track: Track) {
  const previousTrackId = activeTrack.value?.id ?? null;
  player.setCurrentTrack(track);
  const nextTrack = track;
  currentPlaybackTrack.value = nextTrack;
  const pluginTrack = findPluginTrackForQueueTrack(track);
  if (previousTrackId !== nextTrack.id) {
    playbackTime.value = 0;
  }

  if (pluginTrack) {
    onlineActiveTrack.value = nextTrack;
    onlineActivePluginTrack.value = pluginTrack;
    onlinePlaybackSource.value = nextTrack.path;
    onlineActiveTrackKey.value = getOnlineTrackKey(pluginTrack);
    if (!nextTrack.path.startsWith('plugin://')) {
      void loadPlaybackTrackLyricsInBackground(pluginTrack, nextTrack);
    }
  } else {
    onlineActiveTrack.value = null;
    onlineActivePluginTrack.value = null;
    onlinePlaybackSource.value = '';
    onlineActiveTrackKey.value = null;
    void loadLocalTrackLyricsInBackground(nextTrack);
  }

  syncLyricsViewStateForTrack(nextTrack);
  selectedTrack.value = nextTrack;
  player.recordRecentlyPlayed(nextTrack);
}

function handleRustQueueSnapshot(snapshot: RustQueueSnapshot) {
  const mergedTracks = mergeQueueRuntimeMetadata(snapshot.tracks);
  rustPlaybackQueue.value = dedupePlaybackQueue(mergedTracks);
  const currentSource = snapshot.currentSource ?? '';
  const normalizedSource = currentSource ? normalizePath(currentSource) : '';
  const track = mergedTracks.find((item) => (
    normalizePath(item.path) === normalizedSource
    || normalizePath(queueSourceKey(item)) === normalizedSource
  )) ?? null;
  if (track) {
    const pluginTrack = findPluginTrackForQueueTrack(track);
    if (pluginTrack && currentSource.startsWith('plugin://')) {
      queueSwitchingTrackKey.value = getOnlineTrackKey(pluginTrack);
      playbackTime.value = 0;
      isAudioPlaying.value = false;
    } else {
      clearQueueSwitchingForTrack(track);
    }
    handleSeamlessAdvance(track);
  }
}

function withTrackLyrics(
  track: Track,
  target: 'lyrics' | 'associatedLyrics',
  lyrics: TrackLyrics,
  artwork?: string | null,
  sourceName?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
): Track {
  const nextArtwork = artwork?.trim() || null;
  const previousLyrics = target === 'lyrics'
    ? track.lyrics ?? null
    : track.associatedLyrics ?? track.lyrics ?? null;
  const nextLyrics: TrackLyrics = {
    providerId: lyricsProviderId ?? previousLyrics?.providerId ?? null,
    providerName: sourceName ?? previousLyrics?.providerName ?? null,
    trackId: lyricsTrackId ?? previousLyrics?.trackId ?? null,
    defaultFormat: lyrics.defaultFormat ?? previousLyrics?.defaultFormat ?? lyrics.lyrics[0]?.format ?? null,
    lyrics: lyrics.lyrics,
    trackRaw: lyricsTrackRaw ?? previousLyrics?.trackRaw,
  };
  return {
    ...track,
    [target]: nextLyrics,
    ...(target === 'associatedLyrics'
      ? { associatedArtwork: nextArtwork ?? track.associatedArtwork ?? null }
      : { artwork: nextArtwork ?? track.artwork ?? null }),
  };
}

function updateTrackLyricsState(
  target: 'lyrics' | 'associatedLyrics',
  lyrics: TrackLyrics,
  artwork?: string | null,
  sourceName?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
) {
  const active = activeTrack.value;
  if (!active) return;

  const nextTrack = withTrackLyrics(active, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
  if (isSameTrackForMetadata(onlineActiveTrack.value, active)) {
    onlineActiveTrack.value = nextTrack;
  }
  if (isSameTrackForMetadata(selectedTrack.value, active)) {
    selectedTrack.value = nextTrack;
  }
  if (isSameTrackForMetadata(currentPlaybackTrack.value, active)) {
    currentPlaybackTrack.value = nextTrack;
  }
  if (isSameTrackForMetadata(player.currentTrack, active)) {
    player.setCurrentTrack(nextTrack);
  }
  updateLyricsViewStateForRequest(nextTrack, 'ready');

  player.tracks = player.tracks.map((track) => (isSameTrackForMetadata(track, active) ? withTrackLyrics(track, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
  player.queue = player.queue.map((track) => (isSameTrackForMetadata(track, active) ? withTrackLyrics(track, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
  rustPlaybackQueue.value = rustPlaybackQueue.value.map((track) => (isSameTrackForMetadata(track, active) ? withTrackLyrics(track, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
}

function updateActiveTrackSourceLyrics(
  lyrics: TrackLyrics,
  artwork?: string | null,
  sourceName?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
) {
  updateTrackLyricsState('lyrics', lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
}

function updateActiveTrackLyrics(
  lyrics: TrackLyrics,
  artwork?: string | null,
  sourceName?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
) {
  updateTrackLyricsState('associatedLyrics', lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
}

function withoutAssociatedTrackLyrics(track: Track): Track {
  return {
    ...track,
    associatedLyrics: null,
    associatedArtwork: null,
  };
}

function clearActiveTrackLyrics() {
  const active = activeTrack.value;
  if (!active) return;

  const nextTrack = withoutAssociatedTrackLyrics(active);
  if (isSameTrackForMetadata(onlineActiveTrack.value, active)) {
    onlineActiveTrack.value = nextTrack;
  }
  if (isSameTrackForMetadata(selectedTrack.value, active)) {
    selectedTrack.value = nextTrack;
  }
  if (isSameTrackForMetadata(currentPlaybackTrack.value, active)) {
    currentPlaybackTrack.value = nextTrack;
  }
  if (isSameTrackForMetadata(player.currentTrack, active)) {
    player.setCurrentTrack(nextTrack);
  }
  syncLyricsViewStateForTrack(nextTrack);

  player.tracks = player.tracks.map((track) => (isSameTrackForMetadata(track, active) ? withoutAssociatedTrackLyrics(track) : track));
  player.queue = player.queue.map((track) => (isSameTrackForMetadata(track, active) ? withoutAssociatedTrackLyrics(track) : track));
  rustPlaybackQueue.value = rustPlaybackQueue.value.map((track) => (isSameTrackForMetadata(track, active) ? withoutAssociatedTrackLyrics(track) : track));
}

async function syncRustPlaybackMode() {
  try {
    handleRustQueueSnapshot(await setRustBackendPlaybackMode(player.playbackMode));
  } catch (error) {
    showOnlineToast(getErrorMessage(error), 'error');
  }
}

async function togglePlaybackMode() {
  player.togglePlaybackMode();
  await syncRustPlaybackMode();
}

async function setPlaybackMode(mode: PlaybackMode) {
  player.playbackMode = mode;
  await syncRustPlaybackMode();
}

async function removeTrackFromRustQueue(track: Track) {
  try {
    handleRustQueueSnapshot(await removeRustBackendQueueSource(queueSourceKey(track)));
  } catch (error) {
    showOnlineToast(getErrorMessage(error));
  }
}

function syncRemovedFavoriteTrack(track: Track | null) {
  if (!track || activeCollection.value !== 'favorites' || activePlaylistId.value) return;
  void removeTrackFromRustQueue(track);
}

function toggleFavoriteTrack() {
  const track = activeTrack.value;
  const wasFavorite = player.isFavorite(track);
  player.toggleFavorite(track);
  if (wasFavorite) syncRemovedFavoriteTrack(track);
}

function toggleFavoriteForTrack(track: Track) {
  const wasFavorite = player.isFavorite(track);
  player.toggleFavorite(track);
  if (wasFavorite) syncRemovedFavoriteTrack(track);
}

function addTrackToFavorites(track: Track) {
  if (!player.isFavorite(track)) {
    player.toggleFavorite(track);
  }
  closeContextMenus();
}

async function playActiveTrack(startTime = 0) {
  const track = activeTrack.value;
  if (!track?.path) return;
  const currentQueue = rustPlaybackQueue.value.length ? rustPlaybackQueue.value : visibleTracks.value;
  const queueHasTrack = currentQueue.some((item) => (
    item.id === track.id
    || normalizePath(item.path) === normalizePath(track.path)
    || queueSourceKey(item) === queueSourceKey(track)
  ));
  player.error = null;
  await startRustPlaybackQueue(queueHasTrack ? currentQueue : [track], track, startTime);
}

async function handleTrayMenuAction(action: string) {
  if (action === 'toggle-play') {
    togglePlaybackRequestId.value += 1;
    return;
  }

  if (action === 'previous') {
    await playPreviousTrack();
    return;
  }

  if (action === 'next') {
    await playNextTrack();
    return;
  }

  if (action === 'mode-shuffle') {
    await setPlaybackMode('shuffle');
    return;
  }

  if (action === 'mode-repeat') {
    await setPlaybackMode('repeat');
    return;
  }

  if (action === 'mode-fixed') {
    await setPlaybackMode('fixed');
    return;
  }

  if (action === 'settings') {
    openSettingsView();
  }
}

async function handleDesktopLyricsAction(action: DesktopLyricsAction) {
  if (action === 'previous') {
    await playPreviousTrack();
    return;
  }

  if (action === 'toggle-play') {
    togglePlaybackRequestId.value += 1;
    return;
  }

  if (action === 'next') {
    await playNextTrack();
  }
}

async function handleSystemMediaAction(event: SystemMediaAction) {
  if (event.action === 'previous') {
    await playPreviousTrack();
    return;
  }

  if (event.action === 'next') {
    await playNextTrack();
    return;
  }

  if (event.action === 'play') {
    if (!isAudioPlaying.value) togglePlaybackRequestId.value += 1;
    return;
  }

  if (event.action === 'pause') {
    if (isAudioPlaying.value) togglePlaybackRequestId.value += 1;
    return;
  }

  if (event.action === 'toggle') {
    togglePlaybackRequestId.value += 1;
    return;
  }

  if (event.action === 'stop') {
    if (isAudioPlaying.value) togglePlaybackRequestId.value += 1;
    return;
  }

  if (event.action === 'seek' && typeof event.position === 'number') {
    seekTime.value = Math.max(0, event.position);
    seekRequestId.value += 1;
    return;
  }

  if ((event.action === 'seek-forward' || event.action === 'seek-backward') && typeof event.offset === 'number') {
    const direction = event.action === 'seek-forward' ? 1 : -1;
    seekTime.value = Math.max(0, playbackTime.value + direction * event.offset);
    seekRequestId.value += 1;
    return;
  }

  if (event.action === 'raise') {
    const window = getCurrentWindow();
    await window.show();
    await window.setFocus();
    return;
  }

  if (event.action === 'quit') {
    await handleAppCloseRequest();
  }
}

const { handleAppCloseRequest } = useTrayIntegration({
  activeTrack,
  handleTrayMenuAction,
  isAudioPlaying,
  player,
  savePlaybackSessionNow,
});

async function handleSleepTimerExit() {
  savePlaybackSessionNow();
  await exitApp();
}

async function seekToLyric(time: number) {
  if (!player.currentSource && activeTrack.value?.path) {
    await playActiveTrack(time);
    return;
  }

  seekTime.value = time;
  seekRequestId.value += 1;
}

function toggleLyricsView() {
  if (isLyricsOpen.value) {
    closeLyricsView();
    return;
  }

  isLibraryVisible.value = true;
  isLyricsTransitioning.value = true;
  isLyricsOpen.value = true;
}

async function openDesktopLyrics() {
  await openDesktopLyricsWindow();
  await broadcastCurrentDesktopLyricsState();
}

function closeLyricsView() {
  isLibraryVisible.value = true;
  isLyricsTransitioning.value = true;
  isLyricsOpen.value = false;
}

function showLibraryAfterLyricsLeave() {
  isLibraryVisible.value = true;
  isLyricsTransitioning.value = false;
}

function finishLyricsEnter() {
  isLyricsTransitioning.value = false;
}

</script>

<template>
  <main
    class="mono-window"
    :class="{
      'sidebar-collapsed': isSidebarCollapsed,
      'lyrics-open': isLyricsOpen || isLyricsTransitioning,
      'has-theme-background': hasThemeBackground,
    }"
    @click="closeContextMenus"
    @contextmenu="closeContextMenus"
    @pointerdown="startWindowDrag"
  >
    <WindowControls class="floating-window-controls" @request-close="handleAppCloseRequest" />

    <div v-if="!isAppReady" class="app-startup-loading" role="status" aria-live="polite">
      <div class="app-startup-mark">M</div>
      <span>{{ startupLoadingText }}</span>
    </div>

    <template v-else>
    <PlaylistContextMenu
      v-if="playlistContextMenu"
      :menu="playlistContextMenu"
      :locale="player.settings.locale"
      @rename="startRenamePlaylist"
      @delete="deletePlaylist"
    />

    <TrackContextMenu
      v-if="trackContextMenu"
      :active-playlist-id="activePlaylistId"
      :can-edit-metadata="canEditTrackMetadata"
      :can-change-cover="canChangeTrackCover"
      :can-refresh-duration="canRefreshTrackDuration"
      :is-downloaded="isTrackDownloaded(trackContextMenu.track)"
      :is-favorite="player.isFavorite(trackContextMenu.track)"
      :locale="player.settings.locale"
      :menu="trackContextMenu"
      @queue-next="queueTrackNextFromContext"
      @queue-last="queueTrackLast"
      @add-to-favorite="addTrackToFavorites"
      @add-to-playlist="openAddToPlaylistDialog"
      @download-track="downloadTrack"
      @edit-metadata="openTrackMetadataDialog"
      @change-cover="changeTrackCover"
      @refresh-duration="refreshLocalTrackDuration"
      @remove-from-playlist="removeTrackFromActivePlaylist"
      @open-folder="openTrackFolder"
    />

    <AppDialogs
      :add-to-playlist-track="addToPlaylistTrack"
      :editing-playlist-id="editingPlaylistId"
      :is-canceling-scan="isCancelingScan"
      :is-confirming-scan="isConfirmingScan"
      :is-playlist-dialog-open="isPlaylistDialogOpen"
      :is-saving-track-metadata="isSavingTrackMetadata"
      :is-scan-dialog-open="isScanDialogOpen"
      :locale="player.settings.locale"
      :metadata-editing-track="metadataEditingTrack"
      :new-playlist-name="newPlaylistName"
      :playlists="player.settings.playlists"
      :scan-folders="scanFolders"
      :scan-progress-text="scanProgressText"
      :track-metadata-error="trackMetadataError"
      :tracks-for-playlist="tracksForPlaylist"
      @add-scan-folder="addScanFolder"
      @add-track-to-playlist="addTrackToPlaylist"
      @cancel-scan-folders="cancelScanFolders"
      @change-playlist-name="newPlaylistName = $event"
      @close-add-to-playlist-dialog="closeAddToPlaylistDialog"
      @close-create-playlist-dialog="closeCreatePlaylistDialog"
      @close-scan-dialog="closeScanDialog"
      @close-track-metadata-dialog="closeTrackMetadataDialog"
      @confirm-create-playlist="confirmCreatePlaylist"
      @confirm-scan-folders="confirmScanFolders"
      @open-create-playlist-from-add-dialog="openCreatePlaylistFromAddDialog"
      @remove-scan-folder="removeScanFolder"
      @save-track-metadata="saveTrackMetadata"
      @update-scan-folder-checked="updateScanFolderChecked"
    />

    <Transition name="lyrics-slide" @after-enter="finishLyricsEnter" @after-leave="showLibraryAfterLyricsLeave">
      <LyricsView
        v-if="activeTrack"
        v-show="isLyricsOpen"
        :active-track="activeTrack"
        :current-time="playbackTime"
        :is-playing="isAudioPlaying"
        :lyric-format="playbackLyricFormat"
        :lyrics-metadata="playbackLyricMetadata"
        :lyrics-error="lyricsViewState.error"
        :lyrics-status="activeLyricsViewStatus"
        @close="closeLyricsView"
        @cover-changed="activeTrack && applyTrackCoverRefresh(activeTrack.id)"
        @lyrics-cleared="clearActiveTrackLyrics"
        @lyrics-found="updateActiveTrackLyrics"
        @notify="showOnlineToast"
        @seek="seekToLyric"
      />
    </Transition>

    <AppMainContent
      :active-artist-name="activeArtistName"
      :active-collection="activeCollection"
      :active-folder-path="activeFolderPath"
      :active-library-filter="activeLibraryFilter"
      :active-online-provider-id="activeOnlineProviderId"
      :active-playlist-id="activePlaylistId"
      :active-track="activeTrack"
      :active-view="activeView"
      :app-grid-style="appGridStyle"
      :artist-groups="artistGroups"
      :downloaded-track-keys="downloadedTrackKeys"
      :download-items="downloadItems"
      :enable-plugins="player.settings.enablePlugins"
      :favorite-track-ids="player.favoriteTrackIds"
      :is-audio-playing="isAudioPlaying"
      :is-library-panel-mode="isLibraryPanelMode"
      :is-library-visible="isLibraryVisible"
      :is-online-loading-more="isOnlineLoadingMore"
      :is-online-search-open="isOnlineSearchOpen"
      :is-online-searching="isOnlineSearching"
      :is-preparing-active-track="isPreparingActiveTrack"
      :is-resizing-library-panel="isResizingLibraryPanel"
      :is-sidebar-collapsed="isSidebarCollapsed"
      :library-meta="libraryMeta"
      :library-title="libraryTitle"
      :local-folder-track-count="localFolderTrackCount"
      :local-folders="localFolders"
      :online-load-more-error="onlineLoadMoreError"
      :online-preparing-track-key="onlinePreparingTrackKey"
      :online-search-error="onlineSearchError"
      :online-search-has-more="onlineSearchHasMore"
      :online-search-providers="onlineSearchProviders"
      :online-search-query="onlineSearchQuery"
      :online-search-results="onlineSearchResults"
      :online-active-track-key="onlineActiveTrackKey"
      :pending-download-track-keys="pendingDownloadTrackKeys"
      :playback-spectrum-levels="playbackSpectrumLevels"
      :player-error="player.error"
      :player-query="player.query"
      :playlists="player.settings.playlists ?? []"
      :recent-added-track-count="recentAddedTrackCount"
      :search-history="searchHistory"
      :should-show-downloads-menu="shouldShowDownloadsMenu"
      :should-show-library-resize-handle="shouldShowLibraryResizeHandle"
      :visible-tracks="visibleTracks"
      @add-downloaded-track-to-playlist="addDownloadedTrackToPlaylist"
      @choose-folder="chooseFolder"
      @clear-downloaded-item-record="clearDownloadedItemRecord"
      @create-playlist="openCreatePlaylistDialog"
      @delete-downloaded-item="deleteDownloadedItem"
      @download-track="downloadTrack"
      @load-more-online-music="loadMoreOnlineMusic"
      @open-artist-from-track="openArtistFromTrack"
      @open-artists-view="openArtistsView"
      @open-discover-music-view="openDiscoverMusicView"
      @open-downloaded-item-folder="openDownloadedItemFolder"
      @open-downloads-view="openDownloadsView"
      @open-favorites-view="openFavoritesView"
      @open-local-folder-from-panel="openLocalFolderFromPanel"
      @open-online-track-context-menu="openOnlineTrackContextMenu"
      @open-playlist-context-menu="openPlaylistContextMenu"
      @open-playlist-view="openPlaylistView"
      @open-plugins-view="openPluginsView"
      @open-recent-added="openRecentAdded"
      @open-recent-added-from-panel="openRecentAddedFromPanel"
      @open-recent-played="openRecentPlayed"
      @open-scan-dialog="openScanDialog"
      @open-settings-view="openSettingsView"
      @open-theme-view="openThemeView"
      @open-track-context-menu="openTrackContextMenu"
      @notify="showOnlineToast"
      @pause-download-item="pauseDownloadItem"
      @play-downloaded-track="playDownloadedTrack"
      @play-favorite-tracks="playFavoriteTracks"
      @play-online-track="playOnlineTrack"
      @play-track="playTrack"
      @queue-downloaded-track-next="queueDownloadedTrackNext"
      @rescan-library="player.scanLibrary()"
      @retry-download-item="retryDownloadItem"
      @resume-download-item="resumeDownloadItem"
      @return-to-local-library="returnToLocalLibrary"
      @search-online-music="searchOnlineMusic"
      @select-artist="selectArtist"
      @select-online-provider="selectOnlineProvider"
      @select-track="selectTrack"
      @start-library-panel-resize="startLibraryPanelResize"
      @toggle-favorite-for-track="toggleFavoriteForTrack"
      @toggle-sidebar-collapsed="isSidebarCollapsed = !isSidebarCollapsed"
      @update-online-search-query="onlineSearchQuery = $event"
      @update-player-query="player.query = $event"
    />

    <div
      v-if="shouldAutoHideLyricsDock"
      class="lyrics-dock-hot-zone"
      aria-hidden="true"
      @mouseenter="hoverLyricsDock"
    ></div>

    <Transition name="online-toast">
      <div v-if="onlineToastMessage" class="online-toast" :class="`is-${onlineToastVariant}`" role="status">
        <span>{{ onlineToastMessage }}</span>
        <button type="button" aria-label="关闭提示" @click="closeOnlineToast">×</button>
      </div>
    </Transition>

    <PlayerDock
      :class="{ 'lyrics-auto-hidden': isLyricsDockHidden }"
      :active-track="activeTrack"
      :can-control-playback="Boolean(currentPlaybackSource)"
      :lyrics-open="isLyricsOpen"
      :is-favorite="isActiveTrackFavorite"
      :playback-mode="player.playbackMode"
      :playback-mode-label="player.playbackModeLabel"
      :lyric-format="playbackLyricFormat"
      :lyric-formats="playbackLyricFormats"
      :online-quality="onlinePlaybackQuality"
      :online-quality-options="onlinePlaybackQualityOptions"
      :queue="rustPlaybackQueue"
      :restore-request-id="restorePlaybackRequestId"
      :restore-time="restorePlaybackTime"
      :seek-request-id="seekRequestId"
      :seek-time="seekTime"
      :is-preparing-active-track="isPreparingActiveTrack"
      :show-active-track-download="shouldShowActiveTrackDownload"
      :is-active-track-downloaded="isActiveOnlineTrackDownloaded"
      :is-active-track-downloading="isActiveOnlineTrackDownloading"
      :show-lyric-format="shouldShowLyricFormat && isLyricsOpen"
      :show-online-quality="shouldShowOnlineQuality"
      :sleep-timer-request="sleepTimerRequest"
      :sleep-timer-request-id="sleepTimerRequestId"
      :toggle-playback-request-id="togglePlaybackRequestId"
      @mouseenter="hoverLyricsDock"
      @mouseleave="leaveLyricsDock"
      @download-active-track="downloadActiveOnlineTrack"
      @open-desktop-lyrics="openDesktopLyrics"
      @open-lyrics="toggleLyricsView"
      @lyric-format-change="changeLyricFormat"
      @online-quality-change="changeOnlinePlaybackQuality"
      @play-next="playNextTrack"
      @play-previous="playPreviousTrack"
      @play-queue-track="playQueueTrack"
      @playback-error="handlePlaybackFailure"
      @playback-state-change="isAudioPlaying = $event"
      @spectrum-change="playbackSpectrumLevels = $event"
      @request-initial-playback="playActiveTrack"
      @seamless-advance="handleSeamlessAdvance"
      @sleep-timer-exit="handleSleepTimerExit"
      @time-change="playbackTime = $event"
      @toggle-favorite="toggleFavoriteTrack"
      @toggle-playback-mode="togglePlaybackMode"
    />

    </template>

  </main>
</template>

<style scoped>
.app-startup-loading {
  position: relative;
  z-index: 2;
  grid-row: 1 / 3;
  display: grid;
  gap: 12px;
  place-content: center;
  justify-items: center;
  min-height: 100vh;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-canvas);
  font-size: 13px;
}

.app-startup-mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: var(--smw-button-primary);
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
}

.online-toast {
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 520;
  display: inline-flex;
  align-items: flex-start;
  gap: 12px;
  max-width: min(420px, calc(100vw - 48px));
  padding: 12px 14px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  font-size: 13px;
  line-height: 1.5;
}

.online-toast.is-success {
  border-color: color-mix(in srgb, var(--smw-accent-blue) 58%, var(--smw-border));
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-workspace) 84%, var(--smw-accent-blue));
}

.online-toast.is-error {
  border-color: var(--smw-error-border);
  color: var(--smw-error-text);
  background: var(--smw-error-bg);
}

.online-toast span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.online-toast button {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.online-toast button:hover {
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.online-toast-enter-active,
.online-toast-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.online-toast-enter-from,
.online-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 820px) {
  .library-resize-handle {
    display: none;
  }
}
</style>
