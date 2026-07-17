<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import AddToPlaylistDialog from './components/AddToPlaylistDialog.vue';
import ArtistsView from './components/ArtistsView.vue';
import DownloadManagerView from './components/DownloadManagerView.vue';
import DiscoverMusicView from './components/DiscoverMusicView.vue';
import LibraryPanel from './components/LibraryPanel.vue';
import PlaylistContextMenu from './components/PlaylistContextMenu.vue';
import PlaylistDialog from './components/PlaylistDialog.vue';
import PluginManagerView from './components/PluginManagerView.vue';
import PluginSearchView from './components/PluginSearchView.vue';
import LyricsView from './components/LyricsView.vue';
import LibraryContentLayout from './components/LibraryContentLayout.vue';
import PlayerDock from './components/PlayerDock.vue';
import PrimarySidebar from './components/PrimarySidebar.vue';
import ScanDialog from './components/ScanDialog.vue';
import SettingsView from './components/SettingsView.vue';
import ThemeView from './components/ThemeView.vue';
import TrackContextMenu from './components/TrackContextMenu.vue';
import TrackMetadataDialog from './components/TrackMetadataDialog.vue';
import type { TrackMetadataFormValue } from './components/TrackMetadataDialog.vue';
import WindowControls from './components/WindowControls.vue';
import WorkspaceView from './components/WorkspaceView.vue';
import { useLibraryNavigation } from './composables/useLibraryNavigation';
import { usePlaybackSession } from './composables/usePlaybackSession';
import { usePlaylistActions } from './composables/usePlaylistActions';
import { useScanFolders } from './composables/useScanFolders';
import { useSidebarCollapse } from './composables/useSidebarCollapse';
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
import { clearCoverThumbnailCache, exitApp, isTauriRuntime, refreshTrackDuration, resolveLocalTrackLyrics, updateTrackCover, updateTrackMetadata } from './services/music';
import { getPluginLyricsMetadata, listPluginSearchProviders, resolvePluginPlaybackQualitiesWithRust, resolvePluginPlaybackSourceWithRust, searchPluginMusic } from './services/pluginSearch';
import { getRustBackendDefaultCacheDir, listenRustBackendQueue, playRustBackendNext, playRustBackendPrevious, setRustBackendCacheDir, setRustBackendQueue, startRustBackendQueue, stopRustBackend, type RustQueueSnapshot } from './services/playerBackend';
import { readPersistentValue, writePersistentValue } from './services/persistentStore';
import { clearSystemMedia, listenSystemMediaAction, updateSystemMedia, type SystemMediaAction } from './services/systemMedia';
import { usePlayerStore } from './stores/player';
import type { DownloadItem, PlaybackMode, Track, TrackLyrics } from './types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption, PluginSearchProvider, PluginSearchTrack } from './types/plugin';
import { getErrorMessage } from './utils/error';
import { folderTitle, normalizePath } from './utils/path';
import { normalizeTrackLyrics } from './utils/trackLyrics';
import { shouldSkipWindowDrag } from './utils/windowDrag';

const player = usePlayerStore();
const { isSidebarCollapsed } = useSidebarCollapse();
const isLyricsOpen = ref(false);
const isLyricsTransitioning = ref(false);
const isLibraryVisible = ref(true);
const playRequestId = ref(0);
const togglePlaybackRequestId = ref(0);
const playbackTime = ref(0);
const isAudioPlaying = ref(false);
const playbackSpectrumLevels = ref<number[]>([]);
const isLyricsDockHovered = ref(false);
const isLyricsDockReadyToHide = ref(false);
const seekRequestId = ref(0);
const seekTime = ref(0);
const selectedTrack = ref<Track | null>(null);
const rustPlaybackQueue = ref<Track[]>([]);
const isOnlineSearchOpen = ref(false);
const isOnlineSearching = ref(false);
const isOnlineLoadingMore = ref(false);
const onlineSearchQuery = ref('');
const onlineSearchError = ref<string | null>(null);
const onlineLoadMoreError = ref<string | null>(null);
const onlineSearchProviders = ref<PluginSearchProvider[]>([]);
const onlineSearchResults = ref<PluginSearchTrack[]>([]);
const activeOnlineProviderId = ref<string | null>(null);
const onlineSearchPage = ref(1);
const onlineSearchHasMore = ref(false);
const onlineActiveTrack = ref<Track | null>(null);
const onlineActivePluginTrack = ref<PluginSearchTrack | null>(null);
const onlinePlaybackSource = ref('');
const onlinePlaybackQuality = ref<PluginPlaybackQuality>('');
const onlinePlaybackQualityOptions = ref<PluginPlaybackQualityOption[]>([]);
const onlineResolvingTrackKey = ref<string | null>(null);
const onlineActiveTrackKey = ref<string | null>(null);
type OnlineToastVariant = 'success' | 'error';
type SleepTimerAction = 'stop' | 'exit' | 'finishTrack';
interface McpSleepTimerRequest {
  minutes: number;
  action: SleepTimerAction | null;
}
const onlineToastMessage = ref<string | null>(null);
const onlineToastVariant = ref<OnlineToastVariant>('error');
const sleepTimerRequestId = ref(0);
const sleepTimerRequest = ref<McpSleepTimerRequest | null>(null);
const metadataEditingTrack = ref<Track | null>(null);
const isSavingTrackMetadata = ref(false);
const trackMetadataError = ref<string | null>(null);
const downloadItems = ref<DownloadItem[]>([]);
const searchHistory = ref<string[]>([]);
const DOWNLOAD_ITEMS_KEY = 'downloads.items';
const SEARCH_HISTORY_KEY = 'search.history';
const EXCLUDED_SEARCH_HISTORY_KEYWORDS = new Set(['热门歌曲', '热门歌手']);
const RUST_CROSSFADE_DURATION_MS = 3000;
const LIBRARY_PANEL_WIDTH_KEY = 'layout.libraryPanelWidth';
const MIN_LIBRARY_PANEL_WIDTH = 220;
const MAX_LIBRARY_PANEL_WIDTH = 260;
let lyricsDockHideTimer: number | null = null;
let onlineToastTimer: number | null = null;
let desktopLyricsActionUnlisten: UnlistenFn | null = null;
let desktopLyricsReadyUnlisten: UnlistenFn | null = null;
let downloadEventUnlisten: UnlistenFn | null = null;
let mcpSleepTimerUnlisten: UnlistenFn | null = null;
let rustQueueUnlisten: UnlistenFn | null = null;
let systemMediaUnlisten: UnlistenFn | null = null;
let libraryPanelResizeStartX = 0;
let libraryPanelResizeStartWidth = 0;
let lastSystemMediaSyncKey = '';
let lastSystemMediaSyncAt = 0;

const searchHistoryLimit = computed(() => Math.max(1, Math.round(player.settings.searchHistoryLimit)));
const libraryPanelWidth = ref(260);
const isResizingLibraryPanel = ref(false);
const appGridStyle = computed(() => ({
  '--library-width': `${libraryPanelWidth.value}px`,
}));
const shouldShowLibraryResizeHandle = computed(() => {
  if (activeView.value === 'artists') return true;
  return activeView.value === 'library' && activeCollection.value === 'all' && isLibraryPanelMode.value;
});
const shouldShowDownloadsMenu = computed(() => player.settings.enablePlugins || downloadItems.value.length > 0);
const downloadedTrackKeys = computed(() => (
  downloadItems.value
    .filter((item) => item.status === 'downloaded')
    .map((item) => item.id)
));
const pendingDownloadTrackKeys = computed(() => (
  downloadItems.value
    .filter((item) => item.status === 'downloading' || item.status === 'paused')
    .map((item) => item.id)
));

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
    rustPlaybackQueue.value = dedupePlaybackQueue(snapshot.tracks);
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

const activeTrack = computed(() => {
  if (onlineActiveTrack.value) return onlineActiveTrack.value;
  return player.currentTrack ?? selectedTrack.value ?? visibleTracks.value[0] ?? null;
});
const lyricsViewKey = computed(() => {
  const track = activeTrack.value;
  return track ? `${track.id}:${track.path}` : '';
});

const currentPlaybackSource = computed(() => {
  if (onlineActiveTrack.value) return onlinePlaybackSource.value;
  return onlinePlaybackSource.value || player.currentSource;
});

const shouldShowOnlineQuality = computed(() => {
  return Boolean(
    onlineActiveTrack.value
    && onlineActivePluginTrack.value
    && isRemoteTrack(onlineActiveTrack.value),
  );
});
const activeLyricFormats = computed(() => {
  const formats = normalizeTrackLyrics(activeTrack.value)?.formats ?? [];
  return formats.filter((format, index) => format && formats.indexOf(format) === index);
});
const activeLyricFormat = computed(() => {
  const lyrics = normalizeTrackLyrics(activeTrack.value);
  return lyrics?.format ?? lyrics?.defaultFormat ?? activeLyricFormats.value[0] ?? null;
});
const shouldShowLyricFormat = computed(() => {
  const active = activeTrack.value;
  return Boolean(
    activeLyricFormats.value.length > 1
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
const isPreparingActiveTrack = computed(() => Boolean(
  onlineActiveTrack.value
  && onlineResolvingTrackKey.value
  && onlineActiveTrackKey.value === onlineResolvingTrackKey.value,
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

function pruneRemovedLocalTracksFromQueue() {
  const libraryTrackKeys = new Set(player.tracks.map((track) => `${track.id}:${normalizePath(track.path)}`));
  const nextQueue = rustPlaybackQueue.value.filter((track) => {
    if (!isLocalLibraryTrack(track)) return true;
    return libraryTrackKeys.has(`${track.id}:${normalizePath(track.path)}`);
  });

  if (nextQueue.length === rustPlaybackQueue.value.length) return;

  rustPlaybackQueue.value = nextQueue;
  const currentSource = nextQueue.some((track) => track.path === activeTrack.value?.path)
    ? activeTrack.value?.path ?? null
    : null;
  void setRustBackendQueue(
    nextQueue,
    currentSource,
    player.playbackMode,
    player.settings.seamlessPlayback,
    player.settings.crossfadePlayback,
    RUST_CROSSFADE_DURATION_MS,
  ).catch((error) => {
    showOnlineToast(getErrorMessage(error));
  });
}

watch(
  () => player.tracks.map((track) => `${track.id}:${track.path}`).join('|'),
  pruneRemovedLocalTracksFromQueue,
);

watch(
  () => onlineActivePluginTrack.value ? getOnlineTrackKey(onlineActivePluginTrack.value) : '',
  () => {
    void refreshOnlinePlaybackQualities();
  },
);

async function refreshOnlinePlaybackQualities() {
  const track = onlineActivePluginTrack.value;
  onlinePlaybackQualityOptions.value = [];
  if (!track) return;

  try {
    const result = await resolvePluginPlaybackQualitiesWithRust(track);
    onlinePlaybackQualityOptions.value = result.qualities;
    const availableIds = result.qualities
      .filter((quality) => quality.available)
      .map((quality) => quality.id);
    const nextQuality = result.defaultQuality && availableIds.includes(result.defaultQuality)
      ? result.defaultQuality
      : availableIds[0];
    if (nextQuality) {
      onlinePlaybackQuality.value = nextQuality as PluginPlaybackQuality;
    }
  } catch {
    onlinePlaybackQualityOptions.value = [];
  }
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
const shouldAutoHideLyricsDock = computed(() => {
  return player.settings.autoHideLyricsDock && isLyricsOpen.value && isAudioPlaying.value && isLyricsDockReadyToHide.value;
});
const isLyricsDockHidden = computed(() => shouldAutoHideLyricsDock.value && !isLyricsDockHovered.value);
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

function clampLibraryPanelWidth(width: number) {
  return Math.min(MAX_LIBRARY_PANEL_WIDTH, Math.max(MIN_LIBRARY_PANEL_WIDTH, Math.round(width)));
}

async function loadLibraryPanelWidth() {
  const storedWidth = await readPersistentValue<number>(LIBRARY_PANEL_WIDTH_KEY);
  if (typeof storedWidth === 'number' && Number.isFinite(storedWidth)) {
    libraryPanelWidth.value = clampLibraryPanelWidth(storedWidth);
  }
}

function startLibraryPanelResize(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  libraryPanelResizeStartX = event.clientX;
  libraryPanelResizeStartWidth = libraryPanelWidth.value;
  isResizingLibraryPanel.value = true;
  document.body.classList.add('is-resizing-library-panel');
  window.addEventListener('pointermove', resizeLibraryPanel);
  window.addEventListener('pointerup', stopLibraryPanelResize, { once: true });
}

function resizeLibraryPanel(event: PointerEvent) {
  if (!isResizingLibraryPanel.value) return;
  libraryPanelWidth.value = clampLibraryPanelWidth(libraryPanelResizeStartWidth + event.clientX - libraryPanelResizeStartX);
}

function stopLibraryPanelResize() {
  if (!isResizingLibraryPanel.value) return;
  isResizingLibraryPanel.value = false;
  document.body.classList.remove('is-resizing-library-panel');
  window.removeEventListener('pointermove', resizeLibraryPanel);
  void writePersistentValue(LIBRARY_PANEL_WIDTH_KEY, libraryPanelWidth.value);
}



onMounted(async () => {
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
  await startDesktopLyricsActionListener();
  await startDesktopLyricsReadyListener();
  await startDownloadEventListener();
  await startMcpSleepTimerListener();
  await startRustQueueEventListener();
  await startSystemMediaActionListener();
  await player.loadLibrary();
  restoreSavedPlaybackSession();
  rustPlaybackQueue.value = dedupePlaybackQueue(player.queue.filter((track) => track.path));
});

onBeforeUnmount(() => {
  clearLyricsDockHideTimer();
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
  stopLibraryPanelResize();
});

function clearLyricsDockHideTimer() {
  if (lyricsDockHideTimer === null) return;
  window.clearTimeout(lyricsDockHideTimer);
  lyricsDockHideTimer = null;
}

function clearOnlineToastTimer() {
  if (onlineToastTimer === null) return;
  window.clearTimeout(onlineToastTimer);
  onlineToastTimer = null;
}

function showOnlineToast(message: string, variant: OnlineToastVariant = 'error') {
  onlineToastMessage.value = message;
  onlineToastVariant.value = variant;
  clearOnlineToastTimer();
  onlineToastTimer = window.setTimeout(() => {
    onlineToastMessage.value = null;
    onlineToastTimer = null;
  }, 3600);
}

watch(
  () => player.error,
  (message) => {
    if (!message) return;
    showOnlineToast(message);
    player.error = null;
  },
);

function normalizeMetadataText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalPositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalYear(value: string) {
  const parsed = parseOptionalPositiveInteger(value);
  if (parsed === null) return null;
  return parsed >= 1000 && parsed <= 9999 ? parsed : null;
}

function isRemoteTrack(track: Track) {
  return track.path.startsWith('plugin://') || /^https?:\/\//i.test(track.path);
}

function patchTrackMetadata(
  track: Track,
  trackId: number,
  patch: Pick<Track, 'title' | 'artist' | 'album'> & { year?: number | null; genre?: string | null; trackNumber?: number | null },
): Track {
  return track.id === trackId ? { ...track, ...patch } : track;
}

function patchTrackCoverRefresh(track: Track, trackId: number): Track {
  return track.id === trackId ? { ...track, artwork: null, coverVersion: Date.now() } : track;
}

function patchTrackDuration(track: Track, trackId: number, duration: number): Track {
  return track.id === trackId ? { ...track, duration } : track;
}

function applyTrackDurationUpdate(trackId: number, duration: number) {
  const patch = (track: Track) => patchTrackDuration(track, trackId, duration);

  player.tracks = player.tracks.map(patch);
  player.queue = player.queue.map(patch);
  rustPlaybackQueue.value = rustPlaybackQueue.value.map(patch);
  player.settings.playlists = player.settings.playlists.map((playlist) => ({
    ...playlist,
    tracks: (playlist.tracks ?? []).map(patch),
  }));

  if (player.currentTrack?.id === trackId) {
    player.setCurrentTrack(patch(player.currentTrack));
  }
  if (selectedTrack.value?.id === trackId) {
    selectedTrack.value = patch(selectedTrack.value);
  }
}

function applyTrackMetadataUpdate(
  trackId: number,
  patchValue: Pick<Track, 'title' | 'artist' | 'album'> & { year?: number | null; genre?: string | null; trackNumber?: number | null },
) {
  const patch = (track: Track) => patchTrackMetadata(track, trackId, patchValue);

  player.tracks = player.tracks.map(patch);
  player.queue = player.queue.map(patch);
  rustPlaybackQueue.value = rustPlaybackQueue.value.map(patch);
  player.settings.playlists = player.settings.playlists.map((playlist) => ({
    ...playlist,
    tracks: (playlist.tracks ?? []).map(patch),
  }));

  if (player.currentTrack?.id === trackId) {
    player.setCurrentTrack(patch(player.currentTrack));
  }
  if (selectedTrack.value?.id === trackId) {
    selectedTrack.value = patch(selectedTrack.value);
  }
  if (onlineActiveTrack.value?.id === trackId) {
    onlineActiveTrack.value = patch(onlineActiveTrack.value);
  }
}

function applyTrackCoverRefresh(trackId: number) {
  const patch = (track: Track) => patchTrackCoverRefresh(track, trackId);

  player.tracks = player.tracks.map(patch);
  player.queue = player.queue.map(patch);
  rustPlaybackQueue.value = rustPlaybackQueue.value.map(patch);
  player.settings.playlists = player.settings.playlists.map((playlist) => ({
    ...playlist,
    tracks: (playlist.tracks ?? []).map(patch),
  }));

  if (player.currentTrack?.id === trackId) {
    player.setCurrentTrack(patch(player.currentTrack));
  }
  if (selectedTrack.value?.id === trackId) {
    selectedTrack.value = patch(selectedTrack.value);
  }
}

function openTrackMetadataDialog(track: Track) {
  if (!canEditTrackMetadata.value || isRemoteTrack(track)) return;
  metadataEditingTrack.value = track;
  trackMetadataError.value = null;
  closeContextMenus();
}

function closeTrackMetadataDialog() {
  if (isSavingTrackMetadata.value) return;
  metadataEditingTrack.value = null;
  trackMetadataError.value = null;
}

async function saveTrackMetadata(value: TrackMetadataFormValue) {
  const track = metadataEditingTrack.value;
  if (!track) return;

  const title = value.title.trim();
  if (!title) {
    trackMetadataError.value = '歌名不能为空。';
    return;
  }

  const artist = normalizeMetadataText(value.artist);
  const album = normalizeMetadataText(value.album);
  const year = parseOptionalYear(value.year);
  const genre = normalizeMetadataText(value.genre);
  const trackNumber = parseOptionalPositiveInteger(value.trackNumber);
  isSavingTrackMetadata.value = true;
  trackMetadataError.value = null;

  try {
    const result = await updateTrackMetadata({
      id: track.id,
      path: track.path,
      title,
      artist,
      album,
      year,
      genre,
      trackNumber,
    });

    applyTrackMetadataUpdate(track.id, {
      title: result.title,
      artist: result.artist,
      album: result.album,
      year: result.year,
      genre: result.genre,
      trackNumber: result.trackNumber,
    });
    metadataEditingTrack.value = null;
    showOnlineToast('元数据已更新', 'success');
  } catch (error) {
    const message = getErrorMessage(error);
    trackMetadataError.value = null;
    showOnlineToast(`元数据更新失败：${message}`);
  } finally {
    isSavingTrackMetadata.value = false;
  }
}

async function changeTrackCover(track: Track) {
  if (!canChangeTrackCover.value || isRemoteTrack(track)) return;
  closeContextMenus();

  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff'] }],
    });
    if (typeof selected !== 'string') return;

    await updateTrackCover({ path: track.path, coverPath: selected });
    await clearCoverThumbnailCache(track.path);
    applyTrackCoverRefresh(track.id);
    showOnlineToast('封面已更新', 'success');
  } catch (error) {
    const message = getErrorMessage(error);
    showOnlineToast(`封面更新失败：${message}`);
  }
}

async function refreshLocalTrackDuration(track: Track) {
  if (!canRefreshTrackDuration.value || isRemoteTrack(track)) return;
  closeContextMenus();

  try {
    const result = await refreshTrackDuration({ id: track.id, path: track.path });
    applyTrackDurationUpdate(track.id, result.duration);
    showOnlineToast('歌曲时长已更新', 'success');
  } catch (error) {
    const message = getErrorMessage(error);
    showOnlineToast(`读取歌曲时长失败：${message}`);
  }
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

function normalizePlaybackErrorMessage(error: unknown, fallback = '播放失败') {
  const message = getErrorMessage(error, fallback);
  if (message.includes('No next queue source')) {
    return '没有下一首可播放';
  }
  return message || fallback;
}

async function loadDownloadItems() {
  const storedItems = await readPersistentValue<DownloadItem[]>(DOWNLOAD_ITEMS_KEY);
  downloadItems.value = (storedItems ?? []).map((item) => (
    item.status === 'downloading'
      ? { ...item, status: 'failed', progress: 0, error: item.error ?? '下载已中断' }
      : item
  ));
  await persistDownloadItems();
}

async function persistDownloadItems() {
  await writePersistentValue(DOWNLOAD_ITEMS_KEY, downloadItems.value);
}

async function loadSearchHistory() {
  const storedHistory = await readPersistentValue<string[]>(SEARCH_HISTORY_KEY);
  searchHistory.value = (storedHistory ?? [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && !EXCLUDED_SEARCH_HISTORY_KEYWORDS.has(item))
    .slice(0, searchHistoryLimit.value);
  await writePersistentValue(SEARCH_HISTORY_KEY, searchHistory.value);
}

async function saveSearchHistory(keyword: string) {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword || EXCLUDED_SEARCH_HISTORY_KEYWORDS.has(normalizedKeyword)) return;

  searchHistory.value = [
    normalizedKeyword,
    ...searchHistory.value.filter((item) => item !== normalizedKeyword),
  ].slice(0, searchHistoryLimit.value);
  await writePersistentValue(SEARCH_HISTORY_KEY, searchHistory.value);
}

watch(searchHistoryLimit, async (limit) => {
  if (searchHistory.value.length <= limit) return;
  searchHistory.value = searchHistory.value.slice(0, limit);
  await writePersistentValue(SEARCH_HISTORY_KEY, searchHistory.value);
});

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
  const currentItem = downloadItems.value.find((entry) => entry.id === event.taskId);
  if (event.status === 'downloaded') {
    updateDownloadItem(event.taskId, {
      status: 'downloaded',
      progress: 100,
      filePath: event.filePath,
      lyricsPath: event.lyricsPath,
      error: null,
    });
    const item = downloadItems.value.find((entry) => entry.id === event.taskId);
    if (item) {
      showOnlineToast(`下载完成：${item.title}`, 'success');
    }
    return;
  }

  if (event.status === 'failed') {
    if (currentItem?.status === 'paused') return;
    updateDownloadItem(event.taskId, {
      status: 'failed',
      progress: event.progress,
      error: event.error ?? '下载失败',
    });
    const item = downloadItems.value.find((entry) => entry.id === event.taskId);
    if (item) {
      showOnlineToast(`${item.title} 下载失败：${event.error ?? '下载失败'}`);
    }
    return;
  }

  if (currentItem?.status === 'paused') return;
  updateDownloadItem(event.taskId, {
    status: 'downloading',
    progress: event.progress,
    error: null,
  });
}

function closeOnlineToast() {
  clearOnlineToastTimer();
  onlineToastMessage.value = null;
}

function scheduleLyricsDockHide() {
  clearLyricsDockHideTimer();
  isLyricsDockReadyToHide.value = false;

  if (!player.settings.autoHideLyricsDock || !isLyricsOpen.value || !isAudioPlaying.value) {
    return;
  }

  lyricsDockHideTimer = window.setTimeout(() => {
    isLyricsDockReadyToHide.value = true;
    lyricsDockHideTimer = null;
  }, 10000);
}

watch(isAudioPlaying, (playing) => {
  if (!playing) {
    clearLyricsDockHideTimer();
    isLyricsDockReadyToHide.value = false;
    isLyricsDockHovered.value = false;
    return;
  }

  isLyricsDockHovered.value = false;
  scheduleLyricsDockHide();
});

watch(
  () => activeTrack.value?.id,
  () => {
    scheduleLyricsDockHide();
    isLyricsDockHovered.value = false;
  },
);

watch(
  [isLyricsOpen, () => player.settings.autoHideLyricsDock],
  () => {
    scheduleLyricsDockHide();
    isLyricsDockHovered.value = false;
  },
);


function selectTrack(track: Track) {
  selectedTrack.value = track;
}

function returnToLocalLibrary() {
  isOnlineSearchOpen.value = false;
  onlineSearchError.value = null;
  onlineLoadMoreError.value = null;
  onlineResolvingTrackKey.value = null;
  isOnlineLoadingMore.value = false;
  onlineSearchHasMore.value = false;
  openLibraryView();
}

function openLocalFolderFromPanel(path: string) {
  isOnlineSearchOpen.value = false;
  onlineSearchError.value = null;
  onlineLoadMoreError.value = null;
  onlineResolvingTrackKey.value = null;
  isOnlineLoadingMore.value = false;
  onlineSearchHasMore.value = false;
  openFolder(path);
}

function openRecentAddedFromPanel() {
  isOnlineSearchOpen.value = false;
  onlineSearchError.value = null;
  onlineLoadMoreError.value = null;
  onlineResolvingTrackKey.value = null;
  isOnlineLoadingMore.value = false;
  onlineSearchHasMore.value = false;
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

  onlineSearchQuery.value = query;
  await saveSearchHistory(query);
  isOnlineSearchOpen.value = true;
  isOnlineSearching.value = true;
  onlineSearchError.value = null;
  onlineLoadMoreError.value = null;
  onlineSearchResults.value = [];
  onlineSearchPage.value = 1;
  onlineSearchHasMore.value = false;
  isOnlineLoadingMore.value = false;
  activeView.value = shouldStayInDiscover ? 'discover' : 'library';
  activeCollection.value = 'all';
  activeLibraryFilter.value = 'all';
  isLibraryPanelMode.value = !shouldStayInDiscover;
  activeFolderPath.value = null;
  activePlaylistId.value = null;
  activeArtistName.value = null;

  try {
    onlineSearchProviders.value = await listPluginSearchProviders();
    const enabledProviderIds = new Set(onlineSearchProviders.value.filter((provider) => provider.enabled).map((provider) => provider.id));
    const preferredProviderId = providerId ?? activeOnlineProviderId.value;
    const nextProviderId = preferredProviderId && enabledProviderIds.has(preferredProviderId)
      ? preferredProviderId
      : onlineSearchProviders.value.find((provider) => provider.enabled)?.id ?? null;
    activeOnlineProviderId.value = nextProviderId;
    const result = await searchPluginMusic(query, nextProviderId, 1, 30);
    onlineSearchResults.value = result.tracks;
    onlineSearchHasMore.value = !result.isEnd;
  } catch (error) {
    onlineSearchProviders.value = await listPluginSearchProviders();
    const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Plugin search failed.' : '插件搜索失败');
    onlineSearchError.value = message;
    showOnlineToast(message);
  } finally {
    isOnlineSearching.value = false;
  }
}

function openDiscoverMusicView() {
  if (!player.settings.enablePlugins) return;
  openDiscoverView();
  isOnlineSearchOpen.value = false;
  onlineSearchError.value = null;
  onlineLoadMoreError.value = null;
  onlineResolvingTrackKey.value = null;
  isOnlineLoadingMore.value = false;
  onlineSearchHasMore.value = false;
}

async function selectOnlineProvider(providerId: string) {
  if (activeOnlineProviderId.value === providerId || isOnlineSearching.value || isOnlineLoadingMore.value) return;
  activeOnlineProviderId.value = providerId;
  await searchOnlineMusic(onlineSearchQuery.value, providerId);
}

async function loadMoreOnlineMusic(force = false) {
  if (isOnlineSearching.value || isOnlineLoadingMore.value || !onlineSearchHasMore.value) return;
  if (!force && onlineLoadMoreError.value) return;
  const query = onlineSearchQuery.value.trim();
  if (!query || !activeOnlineProviderId.value) return;

  isOnlineLoadingMore.value = true;
  onlineLoadMoreError.value = null;
  let nextPage = onlineSearchPage.value + 1;

  try {
    const existingKeys = new Set(onlineSearchResults.value.map(getOnlineTrackKey));
    let appendedTracks: PluginSearchTrack[] = [];
    let reachedEnd = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await searchPluginMusic(query, activeOnlineProviderId.value, nextPage, 30);
      const nextTracks = result.tracks.filter((track) => !existingKeys.has(getOnlineTrackKey(track)));
      reachedEnd = result.isEnd;

      if (nextTracks.length > 0 || result.isEnd) {
        appendedTracks = nextTracks;
        break;
      }

      nextPage += 1;
    }

    if (appendedTracks.length > 0) {
      const nextResults = [...onlineSearchResults.value, ...appendedTracks];
      onlineSearchResults.value = nextResults;
      onlineSearchPage.value = nextPage;
      onlineSearchHasMore.value = !reachedEnd;
    } else {
      onlineSearchPage.value = nextPage;
      onlineSearchHasMore.value = false;
    }
  } catch (error) {
    const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Failed to load more results.' : '加载更多失败');
    onlineLoadMoreError.value = message;
    showOnlineToast(message);
  } finally {
    isOnlineLoadingMore.value = false;
  }
}

async function playOnlineTrack(track: PluginSearchTrack, startTime = 0) {
  const trackKey = getOnlineTrackKey(track);
  if (onlineResolvingTrackKey.value === trackKey) return;

  const downloadedItem = findDownloadedItemForPluginTrack(track);
  if (downloadedItem?.filePath) {
    const downloadedTrack = createOnlineQueueTrack(track, {
      url: downloadedItem.filePath,
      artwork: track.artwork ?? null,
    });
    playbackTime.value = startTime;
    onlineSearchError.value = null;
    onlineResolvingTrackKey.value = null;
    onlineActiveTrack.value = downloadedTrack;
    onlineActivePluginTrack.value = track;
    onlinePlaybackSource.value = downloadedItem.filePath;
    onlineActiveTrackKey.value = trackKey;
    selectedTrack.value = downloadedTrack;
    rustPlaybackQueue.value = buildOnlinePlaybackQueue(track, downloadedTrack);
    player.error = null;
    await startRustPlaybackQueue(rustPlaybackQueue.value, downloadedTrack, startTime);
    return;
  }

  const pendingTrack = createOnlineQueueTrack(track);
  playbackTime.value = startTime;
  onlineSearchError.value = null;
  onlineResolvingTrackKey.value = trackKey;
  onlineActiveTrack.value = pendingTrack;
  onlineActivePluginTrack.value = track;
  onlinePlaybackSource.value = '';
  onlineActiveTrackKey.value = trackKey;
  selectedTrack.value = null;
  rustPlaybackQueue.value = buildOnlinePlaybackQueue(track, pendingTrack);
  await stopRustBackend(false);
  isAudioPlaying.value = false;

  try {
    const source = await resolvePluginPlaybackSource(track, null, false);
    const onlineTrack = createOnlineQueueTrack(track, source);
    onlineActiveTrack.value = onlineTrack;
    onlinePlaybackSource.value = source.url;
    rustPlaybackQueue.value = buildOnlinePlaybackQueue(track, onlineTrack);
    player.error = null;
    await startRustPlaybackQueue(rustPlaybackQueue.value, onlineTrack, startTime);
    loadOnlineTrackLyricsInBackground(track, onlineTrack);
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

function buildOnlinePlaybackQueue(sourceTrack: PluginSearchTrack, playbackTrack: Track) {
  const sourceKey = getOnlineTrackKey(sourceTrack);
  const searchQueue = onlineSearchResults.value.map((item) => (
    getOnlineTrackKey(item) === sourceKey ? playbackTrack : createOnlineQueueTrack(item)
  ));

  return dedupePlaybackQueue(searchQueue.length > 0 ? searchQueue : [playbackTrack]);
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

function createOnlineQueueTrack(track: PluginSearchTrack, source?: {
  url?: string;
  path?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number | null;
  artwork?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  lyrics?: {
    rawLyrics?: string | null;
    lyricsUrl?: string | null;
    formats?: string[];
    defaultFormat?: string | null;
    format?: string | null;
  } | null;
  sourceId?: string;
  sourceName?: string;
  sourceProviderId?: string;
  sourceRaw?: unknown;
}): Track {
  const rawLyrics = source?.lyrics?.rawLyrics?.trim() || null;
  const lyrics = rawLyrics ? {
    rawLyrics,
    lyricsUrl: source?.lyrics?.lyricsUrl ?? `${track.providerName}@${track.providerId}`,
    formats: source?.lyrics?.formats ?? [],
    defaultFormat: source?.lyrics?.defaultFormat ?? null,
    format: source?.lyrics?.format ?? source?.lyrics?.defaultFormat ?? null,
    providerId: track.providerId,
    providerName: track.providerName,
    trackId: track.id,
    trackRaw: track.raw ?? track,
  } : null;
  return {
    id: getOnlineTrackId(track),
    path: source?.path ?? source?.url ?? `plugin://${track.providerId}/${encodeURIComponent(track.id)}`,
    title: source?.title ?? track.title,
    artist: source?.artist ?? track.artist,
    album: source?.album ?? track.album,
    duration: source?.duration ?? track.duration,
    artwork: source?.artwork ?? track.artwork ?? null,
    year: source?.year ?? track.year ?? null,
    genre: source?.genre ?? track.genre ?? null,
    trackNumber: source?.trackNumber ?? track.trackNumber ?? null,
    lyrics,
    sourceId: source?.sourceId ?? track.id,
    sourceName: source?.sourceName ?? track.providerName,
    sourceProviderId: source?.sourceProviderId ?? track.providerId,
    sourceRaw: source?.sourceRaw ?? track.raw ?? track,
  };
}

function findPluginTrackForQueueTrack(track: Track) {
  const cachedTrack = onlineSearchResults.value.find((item) => {
    if (getOnlineTrackId(item) === track.id) return true;
    return Boolean(track.sourceProviderId && track.sourceId)
      && item.providerId === track.sourceProviderId
      && item.id === track.sourceId;
  })
    ?? (onlineActivePluginTrack.value && (
      getOnlineTrackId(onlineActivePluginTrack.value) === track.id
      || (
        Boolean(track.sourceProviderId && track.sourceId)
        && onlineActivePluginTrack.value.providerId === track.sourceProviderId
        && onlineActivePluginTrack.value.id === track.sourceId
      )
    )
      ? onlineActivePluginTrack.value
      : null);
  if (cachedTrack) return cachedTrack;

  if (!track.sourceProviderId || !track.sourceId) return null;
  return {
    id: track.sourceId,
    providerId: track.sourceProviderId,
    providerName: track.sourceName ?? track.sourceProviderId,
    title: track.title,
    artist: track.artist ?? '',
    album: track.album ?? '',
    duration: track.duration,
    artwork: track.artwork ?? null,
    raw: track.sourceRaw ?? track,
  };
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
    const source = await resolvePluginPlaybackSource(track, quality, false);
    const nextTrack = {
      ...onlineActiveTrack.value,
      path: source.url,
    };
    const nextQueue = (rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [onlineActiveTrack.value])
      .map((item) => (item.id === nextTrack.id ? nextTrack : item));
    onlineActiveTrack.value = nextTrack;
    onlinePlaybackSource.value = source.url;
    rustPlaybackQueue.value = dedupePlaybackQueue(nextQueue);
    await startRustPlaybackQueue(nextQueue, nextTrack, playbackTime.value);
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
  if (!active || format === activeLyricFormat.value) return;

  try {
    const pluginTrack = findPluginTrackForQueueTrack(active);
    const source = pluginTrack
      ? await getPluginLyricsMetadata(pluginTrack, format)
      : !isRemoteTrack(active)
        ? await resolveLocalTrackLyrics(active, format)
        : null;
    const rawLyrics = source?.rawLyrics?.trim();
    if (!source || !rawLyrics) {
      showOnlineToast('这个歌词格式没有可用内容', 'error');
      return;
    }

    updateActiveTrackLyrics(
      rawLyrics,
      active.associatedArtwork ?? null,
      pluginTrack?.providerName ?? null,
      source.lyricsUrl ?? (pluginTrack ? `${pluginTrack.providerName}@${pluginTrack.providerId}` : null),
      source.formats ?? activeLyricFormats.value,
      source.defaultFormat ?? normalizeTrackLyrics(active)?.defaultFormat ?? null,
      source.format ?? format,
      pluginTrack?.providerId ?? null,
      pluginTrack?.id ?? null,
      pluginTrack?.raw ?? pluginTrack ?? null,
    );
  } catch (error) {
    showOnlineToast(getErrorMessage(error), 'error');
  }
}

async function resolvePluginPlaybackSource(
  track: PluginSearchTrack,
  preferredQuality?: PluginPlaybackQuality | null,
  includeMetadata = true,
  syncQuality = true,
) {
  const source = await resolvePluginPlaybackSourceWithRust(track, preferredQuality ?? null, player.settings.qualityFallback, { includeMetadata });
  if (syncQuality) {
    onlinePlaybackQuality.value = source.quality ?? preferredQuality ?? onlinePlaybackQuality.value;
  }
  return source;
}

async function loadOnlineTrackLyricsInBackground(track: PluginSearchTrack, playbackTrack: Track) {
  const trackKey = getOnlineTrackKey(track);
  try {
    const lyrics = await getPluginLyricsMetadata(track);
    const rawLyrics = lyrics.rawLyrics?.trim();
    if (!rawLyrics || onlineActiveTrackKey.value !== trackKey || activeTrack.value?.id !== playbackTrack.id) {
      return;
    }
    updateActiveTrackSourceLyrics(
      rawLyrics,
      playbackTrack.artwork ?? track.artwork ?? null,
      track.providerName,
      lyrics.lyricsUrl ?? `${track.providerName}@${track.providerId}`,
      lyrics.formats ?? [],
      lyrics.defaultFormat ?? null,
      lyrics.format ?? lyrics.defaultFormat ?? null,
      track.providerId,
      track.id,
      track.raw ?? track,
    );
  } catch (error) {
    console.warn('[plugin-lyrics] background lyrics load failed', {
      providerId: track.providerId,
      providerName: track.providerName,
      trackId: track.id,
      title: track.title,
      error,
    });
  }
}

async function loadLocalTrackLyricsInBackground(track: Track) {
  if (normalizeTrackLyrics(track)?.rawLyrics?.trim()) return;

  try {
    const lyrics = await resolveLocalTrackLyrics(track);
    const rawLyrics = lyrics?.rawLyrics?.trim();
    if (!lyrics || !rawLyrics) return;
    updateCurrentLocalTrackLyrics(track, lyrics);
  } catch (error) {
    console.warn('[local-lyrics] background lyrics load failed', {
      path: track.path,
      title: track.title,
      error,
    });
  }
}

function updateCurrentLocalTrackLyrics(track: Track, lyrics: TrackLyrics) {
  if (onlineActiveTrack.value) return;
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
  return `${track.providerId}:${track.id}`;
}

function getDownloadItemIdForPluginTrack(track: PluginSearchTrack) {
  return `${track.providerName}:${track.id}`;
}

function findDownloadedItemForPluginTrack(track: PluginSearchTrack) {
  const itemId = getDownloadItemIdForPluginTrack(track);
  return downloadItems.value.find((item) => (
    item.id === itemId
    && item.status === 'downloaded'
    && Boolean(item.filePath)
  )) ?? null;
}

function getOnlineTrackId(track: PluginSearchTrack) {
  return -Math.abs(hashOnlineTrackId(getOnlineTrackKey(track)));
}

async function startRustPlaybackQueue(tracks: Track[], requestedTrack: Track | null, startPosition = 0) {
  playbackTime.value = startPosition;
  const playbackTracks = dedupePlaybackQueue(tracks);
  await stopRustBackend(false);
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
}

function hashOnlineTrackId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return hash || 1;
}

async function playTrack(track: Track) {
  const pluginTrack = findPluginTrackForQueueTrack(track);
  if (pluginTrack) {
    await playOnlineTrack(pluginTrack);
    return;
  }

  onlineActiveTrack.value = null;
  onlineActivePluginTrack.value = null;
  onlinePlaybackSource.value = '';
  onlineResolvingTrackKey.value = null;
  onlineActiveTrackKey.value = null;
  selectedTrack.value = track;
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
  let nextTrack = track;

  if (track.path.startsWith('plugin://')) {
    const pluginTrack = findPluginTrackForQueueTrack(track);
    if (!pluginTrack) return;

    try {
      const source = await resolvePluginPlaybackSource(pluginTrack, null, true, false);
      nextTrack = createOnlineQueueTrack(pluginTrack, source);
      rustPlaybackQueue.value = dedupePlaybackQueue(
        (rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [track])
          .map((item) => (item.id === track.id ? nextTrack : item)),
      );
    } catch (error) {
      const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Could not get playback URL.' : '无法获取播放地址');
      onlineSearchError.value = message;
      showOnlineToast(message);
      return;
    }
  }

  player.error = null;
  selectedTrack.value = nextTrack;
  await startRustPlaybackQueue(rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [nextTrack], nextTrack);
}

function openOnlineTrackContextMenu(track: PluginSearchTrack, x: number, y: number) {
  openTrackContextMenu(createOnlineQueueTrack(track), x, y);
}

function createDownloadTrack(item: DownloadItem): Track {
  return {
    id: -Math.abs(hashOnlineTrackId(`download:${item.id}`)),
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
  selectedTrack.value = track;
  rustPlaybackQueue.value = dedupePlaybackQueue(queue.length > 0 ? queue : [track]);
  player.playQueue(rustPlaybackQueue.value, track);
  await startRustPlaybackQueue(rustPlaybackQueue.value, track);
}

async function queueTrackNextFromContext(track: Track) {
  const pluginTrack = findPluginTrackForQueueTrack(track);
  if (!pluginTrack) {
    await queueTrackNext(track);
    return;
  }

  closeContextMenus();
  try {
    const source = await resolvePluginPlaybackSource(pluginTrack, null, true, false);
    await queueTrackNext(createOnlineQueueTrack(pluginTrack, source));
  } catch (error) {
    const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Could not get playback URL.' : '无法获取播放地址');
    onlineSearchError.value = message;
    showOnlineToast(message);
  }
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

function getDownloadTrackKey(track: Track) {
  const sourceName = track.sourceName ?? '本地';
  const sourceId = track.sourceId ?? String(track.id);
  return `${sourceName}:${sourceId}`;
}

function isTrackDownloaded(track: Track) {
  return downloadedTrackKeys.value.includes(getDownloadTrackKey(track));
}

function isTrackDownloadPending(track: Track) {
  return pendingDownloadTrackKeys.value.includes(getDownloadTrackKey(track));
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

function updateDownloadItem(id: string, patch: Partial<DownloadItem>) {
  downloadItems.value = downloadItems.value.map((item) => (
    item.id === id ? { ...item, ...patch } : item
  ));
  void persistDownloadItems();
}

async function playPreviousTrack() {
  try {
    handleRustQueueSnapshot(await playRustBackendPrevious());
  } catch (error) {
    const message = normalizePlaybackErrorMessage(error, '切换上一首失败');
    player.error = null;
    showOnlineToast(message);
  }
}

async function playNextTrack() {
  try {
    handleRustQueueSnapshot(await playRustBackendNext());
  } catch (error) {
    const message = normalizePlaybackErrorMessage(error, '切换下一首失败');
    player.error = null;
    showOnlineToast(message);
  }
}

async function handlePlaybackFailure(message: string) {
  player.error = null;
  await stopRustBackend(false);
  isAudioPlaying.value = false;
  showOnlineToast(message);

  if (player.settings.onlinePlaybackFailureAction !== 'next') {
    return;
  }

  try {
    handleRustQueueSnapshot(await playRustBackendNext());
  } catch (error) {
    const nextMessage = normalizePlaybackErrorMessage(error, '没有下一首可播放');
    showOnlineToast(nextMessage);
  }
}

function handleSeamlessAdvance(track: Track) {
  const previousTrackId = activeTrack.value?.id ?? null;
  player.setCurrentTrack(track);
  const nextTrack = track;
  const pluginTrack = findPluginTrackForQueueTrack(track);
  if (previousTrackId !== nextTrack.id) {
    playbackTime.value = 0;
  }

  if (pluginTrack) {
    onlineActiveTrack.value = nextTrack;
    onlineActivePluginTrack.value = pluginTrack;
    onlinePlaybackSource.value = nextTrack.path;
    onlineActiveTrackKey.value = getOnlineTrackKey(pluginTrack);
  } else {
    onlineActiveTrack.value = null;
    onlineActivePluginTrack.value = null;
    onlinePlaybackSource.value = '';
    onlineActiveTrackKey.value = null;
    void loadLocalTrackLyricsInBackground(nextTrack);
  }

  selectedTrack.value = nextTrack;
  player.recordRecentlyPlayed(nextTrack);
}

function handleRustQueueSnapshot(snapshot: RustQueueSnapshot) {
  const mergedTracks = mergeQueueRuntimeMetadata(snapshot.tracks);
  rustPlaybackQueue.value = dedupePlaybackQueue(mergedTracks);
  const normalizedSource = snapshot.currentSource ? normalizePath(snapshot.currentSource) : '';
  const track = mergedTracks.find((item) => normalizePath(item.path) === normalizedSource) ?? null;
  if (track) {
    handleSeamlessAdvance(track);
  }
}

function withTrackLyrics(
  track: Track,
  target: 'lyrics' | 'associatedLyrics',
  rawLyrics: string,
  artwork?: string | null,
  sourceName?: string | null,
  sourceUrl?: string | null,
  formats?: string[],
  defaultFormat?: string | null,
  format?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
): Track {
  const nextArtwork = artwork?.trim() || null;
  const previousLyrics = target === 'lyrics'
    ? track.lyrics ?? null
    : track.associatedLyrics ?? track.lyrics ?? null;
  const lyrics: TrackLyrics = {
    rawLyrics,
    lyricsUrl: sourceUrl ?? previousLyrics?.lyricsUrl ?? null,
    formats: formats ?? previousLyrics?.formats ?? [],
    defaultFormat: defaultFormat ?? previousLyrics?.defaultFormat ?? null,
    format: format ?? previousLyrics?.format ?? defaultFormat ?? null,
    providerId: lyricsProviderId ?? previousLyrics?.providerId ?? null,
    providerName: sourceName ?? previousLyrics?.providerName ?? null,
    trackId: lyricsTrackId ?? previousLyrics?.trackId ?? null,
    trackRaw: lyricsTrackRaw ?? previousLyrics?.trackRaw,
  };
  return {
    ...track,
    [target]: lyrics,
    ...(target === 'associatedLyrics'
      ? { associatedArtwork: nextArtwork ?? track.associatedArtwork ?? null }
      : { artwork: nextArtwork ?? track.artwork ?? null }),
  };
}

function updateTrackLyricsState(
  target: 'lyrics' | 'associatedLyrics',
  rawLyrics: string,
  artwork?: string | null,
  sourceName?: string | null,
  sourceUrl?: string | null,
  formats?: string[],
  defaultFormat?: string | null,
  format?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
) {
  const active = activeTrack.value;
  if (!active) return;

  const nextTrack = withTrackLyrics(active, target, rawLyrics, artwork, sourceName, sourceUrl, formats, defaultFormat, format, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
  if (onlineActiveTrack.value?.id === active.id) {
    onlineActiveTrack.value = nextTrack;
  }
  if (selectedTrack.value?.id === active.id) {
    selectedTrack.value = nextTrack;
  }
  if (player.currentTrack?.id === active.id) {
    player.setCurrentTrack(nextTrack);
  }

  player.tracks = player.tracks.map((track) => (track.id === active.id ? withTrackLyrics(track, target, rawLyrics, artwork, sourceName, sourceUrl, formats, defaultFormat, format, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
  player.queue = player.queue.map((track) => (track.id === active.id ? withTrackLyrics(track, target, rawLyrics, artwork, sourceName, sourceUrl, formats, defaultFormat, format, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
  rustPlaybackQueue.value = rustPlaybackQueue.value.map((track) => (track.id === active.id ? withTrackLyrics(track, target, rawLyrics, artwork, sourceName, sourceUrl, formats, defaultFormat, format, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
}

function updateActiveTrackSourceLyrics(
  rawLyrics: string,
  artwork?: string | null,
  sourceName?: string | null,
  sourceUrl?: string | null,
  formats?: string[],
  defaultFormat?: string | null,
  format?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
) {
  updateTrackLyricsState('lyrics', rawLyrics, artwork, sourceName, sourceUrl, formats, defaultFormat, format, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
}

function updateActiveTrackLyrics(
  rawLyrics: string,
  artwork?: string | null,
  sourceName?: string | null,
  sourceUrl?: string | null,
  formats?: string[],
  defaultFormat?: string | null,
  format?: string | null,
  lyricsProviderId?: string | null,
  lyricsTrackId?: string | null,
  lyricsTrackRaw?: unknown,
) {
  updateTrackLyricsState('associatedLyrics', rawLyrics, artwork, sourceName, sourceUrl, formats, defaultFormat, format, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
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
  if (onlineActiveTrack.value?.id === active.id) {
    onlineActiveTrack.value = nextTrack;
  }
  if (selectedTrack.value?.id === active.id) {
    selectedTrack.value = nextTrack;
  }
  if (player.currentTrack?.id === active.id) {
    player.setCurrentTrack(nextTrack);
  }

  player.tracks = player.tracks.map((track) => (track.id === active.id ? withoutAssociatedTrackLyrics(track) : track));
  player.queue = player.queue.map((track) => (track.id === active.id ? withoutAssociatedTrackLyrics(track) : track));
  rustPlaybackQueue.value = rustPlaybackQueue.value.map((track) => (track.id === active.id ? withoutAssociatedTrackLyrics(track) : track));
}

function togglePlaybackMode() {
  player.togglePlaybackMode();
}

function setPlaybackMode(mode: PlaybackMode) {
  player.playbackMode = mode;
}

function toggleFavoriteTrack() {
  player.toggleFavorite(activeTrack.value);
}

function toggleFavoriteForTrack(track: Track) {
  player.toggleFavorite(track);
}

function addTrackToFavorites(track: Track) {
  if (!player.isFavorite(track)) {
    player.toggleFavorite(track);
  }
  closeContextMenus();
}

async function playActiveTrack() {
  if (!activeTrack.value) return;
  await playTrack(activeTrack.value);
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
    setPlaybackMode('shuffle');
    return;
  }

  if (action === 'mode-repeat') {
    setPlaybackMode('repeat');
    return;
  }

  if (action === 'mode-fixed') {
    setPlaybackMode('fixed');
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
    selectedTrack.value = activeTrack.value;
    rustPlaybackQueue.value = dedupePlaybackQueue(visibleTracks.value.filter((track) => track.path));
    player.setCurrentTrack(activeTrack.value);
    await nextTick();
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

    <TrackMetadataDialog
      v-if="metadataEditingTrack"
      :error="trackMetadataError"
      :locale="player.settings.locale"
      :saving="isSavingTrackMetadata"
      :track="metadataEditingTrack"
      @close="closeTrackMetadataDialog"
      @save="saveTrackMetadata"
    />

    <Transition name="lyrics-slide" @after-enter="finishLyricsEnter" @after-leave="showLibraryAfterLyricsLeave">
      <LyricsView
        v-if="activeTrack"
        v-show="isLyricsOpen"
        :key="lyricsViewKey"
        :active-track="activeTrack"
        :current-time="playbackTime"
        :is-playing="isAudioPlaying"
        @close="closeLyricsView"
        @cover-changed="activeTrack && applyTrackCoverRefresh(activeTrack.id)"
        @lyrics-cleared="clearActiveTrackLyrics"
        @lyrics-found="updateActiveTrackLyrics"
        @notify="showOnlineToast"
        @seek="seekToLyric"
      />
    </Transition>

    <div
      v-if="isLibraryVisible"
      class="app-grid"
      :class="{
        'is-resizing-library-panel': isResizingLibraryPanel,
        'settings-grid': activeView === 'settings',
        'theme-grid': activeView === 'themes',
        'plugins-grid': activeView === 'plugins',
        'downloads-grid': activeView === 'downloads',
        'discover-grid': activeView === 'discover',
        'artists-grid': activeView === 'artists',
        'favorites-grid':
          activeView === 'library' &&
          (Boolean(activePlaylistId) || activeCollection === 'favorites' || (!isLibraryPanelMode && (activeLibraryFilter === 'recentAdded' || activeLibraryFilter === 'recentPlayed'))),
      }"
      :style="appGridStyle"
    >
      <PrimarySidebar
        :active-collection="activeCollection"
        :active-library-filter="isLibraryPanelMode && activeLibraryFilter === 'recentAdded' ? 'all' : activeLibraryFilter"
        :active-playlist-id="activePlaylistId"
        :active-view="activeView"
        :collapsed="isSidebarCollapsed"
        :enable-plugins="player.settings.enablePlugins"
        :playlists="player.settings.playlists ?? []"
        :show-downloads="shouldShowDownloadsMenu"
        @create-playlist="openCreatePlaylistDialog"
        @open-playlist-menu="openPlaylistContextMenu"
        @open-playlist="openPlaylistView"
        @open-library="returnToLocalLibrary"
        @open-discover="openDiscoverMusicView"
        @open-favorites="openFavoritesView"
        @open-artists="openArtistsView"
        @open-recent-added="openRecentAdded"
        @open-recent-played="openRecentPlayed"
        @open-downloads="openDownloadsView"
        @open-plugins="openPluginsView"
        @open-settings="openSettingsView"
        @open-theme="openThemeView"
        @toggle-collapsed="isSidebarCollapsed = !isSidebarCollapsed"
      />
      <LibraryContentLayout v-if="activeView === 'library' && activeCollection === 'all' && isLibraryPanelMode">
        <template #panel>
          <LibraryPanel
          :active-collection="activeCollection"
          :active-folder-path="activeFolderPath"
          :active-library-filter="activeLibraryFilter"
          :active-online-search="isOnlineSearchOpen"
          :local-folders="localFolders"
          :recent-added-count="recentAddedTrackCount"
          :visible-track-count="localFolderTrackCount"
          @choose-folder="chooseFolder"
          @open-all="returnToLocalLibrary"
          @open-folder="openLocalFolderFromPanel"
          @open-recent-added="openRecentAddedFromPanel"
          @open-scan-dialog="openScanDialog"
        />
        </template>
        <template #detail>
          <PluginSearchView
            v-if="activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath && !activePlaylistId && isOnlineSearchOpen"
            :active-provider-id="activeOnlineProviderId"
            :active-playback-track="activeTrack"
            :active-track-key="onlineActiveTrackKey"
            :downloaded-track-keys="downloadedTrackKeys"
            :pending-download-track-keys="pendingDownloadTrackKeys"
            :error="onlineSearchError"
            :favorite-track-ids="player.favoriteTrackIds"
            :has-more="onlineSearchHasMore"
            :spectrum-levels="playbackSpectrumLevels"
            :is-playing="isAudioPlaying"
            :load-more-error="onlineLoadMoreError"
            :loading-more="isOnlineLoadingMore"
            :loading="isOnlineSearching"
            :providers="onlineSearchProviders"
            :query="onlineSearchQuery"
            :resolving-track-key="onlineResolvingTrackKey"
            :results="onlineSearchResults"
            @back-local="returnToLocalLibrary"
            @download-track="downloadTrack(createOnlineQueueTrack($event))"
            @load-more="loadMoreOnlineMusic(false)"
            @open-track-menu="openOnlineTrackContextMenu"
            @retry="searchOnlineMusic(onlineSearchQuery)"
            @retry-load-more="loadMoreOnlineMusic(true)"
            @search="searchOnlineMusic"
            @select-provider="selectOnlineProvider"
            @toggle-favorite="toggleFavoriteForTrack"
            @play-track="playOnlineTrack"
          />
          <WorkspaceView
            v-else
            v-model="player.query"
            :active-collection="activeCollection"
            :active-track="activeTrack"
            :error="player.error"
            :favorite-track-ids="player.favoriteTrackIds"
            :spectrum-levels="playbackSpectrumLevels"
            :is-playing="isAudioPlaying"
            :is-playlist-view="Boolean(activePlaylistId)"
            :library-filter="activeLibraryFilter"
            :library-meta="libraryMeta"
            :library-title="libraryTitle"
            :tracks="visibleTracks"
            :use-track-cover="Boolean(activeFolderPath)"
            @choose-folder="chooseFolder"
            @open-artist="openArtistFromTrack"
            @open-track-menu="openTrackContextMenu"
            @play-favorite-tracks="playFavoriteTracks"
            @play-visible-tracks="playFavoriteTracks"
            @play-track="playTrack"
            @rescan="player.scanLibrary()"
            @select-track="selectTrack"
            @toggle-favorite="toggleFavoriteForTrack"
          />
        </template>
      </LibraryContentLayout>
      <div
        v-if="shouldShowLibraryResizeHandle"
        class="library-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整音乐库侧栏宽度"
        @pointerdown="startLibraryPanelResize"
      />
      <PluginSearchView
        v-if="activeView === 'discover' && activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath && !activePlaylistId && isOnlineSearchOpen"
        :active-provider-id="activeOnlineProviderId"
        :active-playback-track="activeTrack"
        :active-track-key="onlineActiveTrackKey"
        :downloaded-track-keys="downloadedTrackKeys"
        :pending-download-track-keys="pendingDownloadTrackKeys"
        :error="onlineSearchError"
        :favorite-track-ids="player.favoriteTrackIds"
        :has-more="onlineSearchHasMore"
        :spectrum-levels="playbackSpectrumLevels"
        :is-playing="isAudioPlaying"
        :load-more-error="onlineLoadMoreError"
        :loading-more="isOnlineLoadingMore"
        :loading="isOnlineSearching"
        :providers="onlineSearchProviders"
        :query="onlineSearchQuery"
        :resolving-track-key="onlineResolvingTrackKey"
        :results="onlineSearchResults"
        @back-local="returnToLocalLibrary"
        @download-track="downloadTrack(createOnlineQueueTrack($event))"
        @load-more="loadMoreOnlineMusic(false)"
        @open-track-menu="openOnlineTrackContextMenu"
        @retry="searchOnlineMusic(onlineSearchQuery)"
        @retry-load-more="loadMoreOnlineMusic(true)"
        @search="searchOnlineMusic"
        @select-provider="selectOnlineProvider"
        @toggle-favorite="toggleFavoriteForTrack"
        @play-track="playOnlineTrack"
      />
      <DiscoverMusicView
        v-else-if="activeView === 'discover'"
        v-model="onlineSearchQuery"
        :search-history="searchHistory"
        @search="searchOnlineMusic"
      />
      <WorkspaceView
        v-else-if="activeView === 'library' && !(activeCollection === 'all' && isLibraryPanelMode)"
        v-model="player.query"
        :active-collection="activeCollection"
        :active-track="activeTrack"
        :error="player.error"
        :favorite-track-ids="player.favoriteTrackIds"
        :spectrum-levels="playbackSpectrumLevels"
        :is-playing="isAudioPlaying"
        :is-playlist-view="Boolean(activePlaylistId)"
        :library-filter="activeLibraryFilter"
        :library-meta="libraryMeta"
        :library-title="libraryTitle"
        :tracks="visibleTracks"
        :use-track-cover="Boolean(activeFolderPath)"
        @choose-folder="chooseFolder"
        @open-artist="openArtistFromTrack"
        @open-track-menu="openTrackContextMenu"
        @play-favorite-tracks="playFavoriteTracks"
        @play-visible-tracks="playFavoriteTracks"
        @play-track="playTrack"
        @rescan="player.scanLibrary()"
        @select-track="selectTrack"
        @toggle-favorite="toggleFavoriteForTrack"
      />
      <ArtistsView
        v-else-if="activeView === 'artists'"
        v-model="player.query"
        :active-artist-name="activeArtistName"
        :active-track="activeTrack"
        :artist-groups="artistGroups"
        :favorite-track-ids="player.favoriteTrackIds"
        :spectrum-levels="playbackSpectrumLevels"
        :is-playing="isAudioPlaying"
        @open-track-menu="openTrackContextMenu"
        @play-track="playTrack"
        @select-artist="selectArtist"
        @select-track="selectTrack"
        @toggle-favorite="toggleFavoriteForTrack"
      />
      <DownloadManagerView
        v-else-if="activeView === 'downloads'"
        :active-track="activeTrack"
        :favorite-track-ids="player.favoriteTrackIds"
        :is-playing="isAudioPlaying"
        :items="downloadItems"
        @queue-next="queueDownloadedTrackNext"
        @add-to-playlist="addDownloadedTrackToPlaylist"
        @delete-download="deleteDownloadedItem"
        @clear-record="clearDownloadedItemRecord"
        @open-folder="openDownloadedItemFolder"
        @pause-download="pauseDownloadItem"
        @retry-download="retryDownloadItem"
        @resume-download="resumeDownloadItem"
        @play-track="playDownloadedTrack"
        @select-track="selectedTrack = $event"
        @toggle-favorite="toggleFavoriteForTrack"
      />
      <ThemeView v-else-if="activeView === 'themes'" />
      <PluginManagerView v-else-if="activeView === 'plugins'" />
      <SettingsView v-else-if="activeView === 'settings'" />
    </div>

    <div
      v-if="shouldAutoHideLyricsDock"
      class="lyrics-dock-hot-zone"
      aria-hidden="true"
      @mouseenter="isLyricsDockHovered = true"
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
      :play-request-id="playRequestId"
      :lyric-format="activeLyricFormat"
      :lyric-formats="activeLyricFormats"
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
      :show-lyric-format="shouldShowLyricFormat"
      :show-online-quality="shouldShowOnlineQuality"
      :sleep-timer-request="sleepTimerRequest"
      :sleep-timer-request-id="sleepTimerRequestId"
      :toggle-playback-request-id="togglePlaybackRequestId"
      @mouseenter="isLyricsDockHovered = true"
      @mouseleave="isLyricsDockHovered = false"
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
      @track-played="player.recordRecentlyPlayed(activeTrack)"
      @time-change="playbackTime = $event"
      @toggle-favorite="toggleFavoriteTrack"
      @toggle-playback-mode="togglePlaybackMode"
    />

    <AddToPlaylistDialog
      v-if="addToPlaylistTrack"
      :locale="player.settings.locale"
      :playlists="player.settings.playlists"
      :track="addToPlaylistTrack"
      :tracks-for-playlist="tracksForPlaylist"
      @close="closeAddToPlaylistDialog"
      @create-playlist="openCreatePlaylistFromAddDialog"
      @add-track="addTrackToPlaylist"
    />

    <PlaylistDialog
      v-if="isPlaylistDialogOpen"
      v-model:name="newPlaylistName"
      :editing="Boolean(editingPlaylistId)"
      :locale="player.settings.locale"
      @close="closeCreatePlaylistDialog"
      @confirm="confirmCreatePlaylist"
    />

    <ScanDialog
      v-if="isScanDialogOpen"
      :canceling="isCancelingScan"
      :confirming="isConfirmingScan"
      :folders="scanFolders"
      :locale="player.settings.locale"
      :progress-text="scanProgressText"
      @close="closeScanDialog"
      @add-folder="addScanFolder"
      @cancel="cancelScanFolders"
      @remove-folder="removeScanFolder"
      @confirm="confirmScanFolders"
      @update-folder-checked="updateScanFolderChecked"
    />
  </main>
</template>

<style scoped>
.library-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--sidebar-width) + var(--library-width) - 4px);
  z-index: 12;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
}

.sidebar-collapsed .library-resize-handle {
  left: calc(var(--sidebar-collapsed-width) + var(--library-width) - 4px);
}

.library-resize-handle::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 1px;
  background: transparent;
  content: '';
  transition: background 140ms ease, box-shadow 140ms ease;
}

.library-resize-handle:hover::after,
.app-grid.is-resizing-library-panel .library-resize-handle::after {
  background: var(--smw-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--smw-accent) 18%, transparent);
}

.app-grid.is-resizing-library-panel {
  transition: none;
}

:global(body.is-resizing-library-panel) {
  cursor: col-resize;
  user-select: none;
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
