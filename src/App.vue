<script setup lang="ts">
import { computed, ref } from 'vue';
import AppDialogs from './components/AppDialogs.vue';
import AppMainContent from './components/AppMainContent.vue';
import AppMenuSurface from './components/AppMenuSurface.vue';
import AppOnlineToast from './components/AppOnlineToast.vue';
import AppPlayerSurface from './components/AppPlayerSurface.vue';
import AppShellLayout from './components/AppShellLayout.vue';
import AppStartupLoading from './components/AppStartupLoading.vue';
import PlaylistContextMenu from './components/PlaylistContextMenu.vue';
import LyricsDockHotZone from './components/LyricsDockHotZone.vue';
import LyricsView from './components/LyricsView.vue';
import TrackContextMenu from './components/TrackContextMenu.vue';
import WindowControls from './components/WindowControls.vue';
import { useActivePlaybackSeekActions } from './composables/useActivePlaybackSeekActions';
import { useActiveTrackState } from './composables/useActiveTrackState';
import { useActiveTrackUiState } from './composables/useActiveTrackUiState';
import { useAppBootstrap } from './composables/useAppBootstrap';
import { useAppContextMenuBindings } from './composables/useAppContextMenuBindings';
import { useAppDialogsBindings } from './composables/useAppDialogsBindings';
import { useAppMainContentSurfaceBindings } from './composables/useAppMainContentSurfaceBindings';
import { useAppPlayerSurfaceBindings } from './composables/useAppPlayerSurfaceBindings';
import { useAppRustPlaybackRuntime } from './composables/useAppRustPlaybackRuntime';
import { useContentNavigationActions } from './composables/useContentNavigationActions';
import { useDownloadController } from './composables/useDownloadController';
import { useDownloadedTrackActions } from './composables/useDownloadedTrackActions';
import { useExternalPlaybackEventBridge } from './composables/useExternalPlaybackEventBridge';
import { useFavoriteTrackActions } from './composables/useFavoriteTrackActions';
import { useLibraryCatalog } from './composables/useLibraryCatalog';
import { useLibraryNavigation } from './composables/useLibraryNavigation';
import { useLibraryPanelResize } from './composables/useLibraryPanelResize';
import { useLocalPlaybackActions } from './composables/useLocalPlaybackActions';
import { useLocalLibraryQueuePruning } from './composables/useLocalLibraryQueuePruning';
import { useLyricsDockAutoHide } from './composables/useLyricsDockAutoHide';
import { useLyricsRendererSettings } from './composables/useLyricsRendererSettings';
import { useLyricsViewVisibility } from './composables/useLyricsViewVisibility';
import { useMusicSourcePluginAvailability } from './composables/useMusicSourcePluginAvailability';
import { useNavigationAvailabilityGuards } from './composables/useNavigationAvailabilityGuards';
import { useOnlinePlaybackController } from './composables/useOnlinePlaybackController';
import { useOnlinePlaybackLookup } from './composables/useOnlinePlaybackLookup';
import { useOnlineQualityRefresh } from './composables/useOnlineQualityRefresh';
import { useOnlineSearchSnapshotBridge } from './composables/useOnlineSearchSnapshotBridge';
import { useOnlineToast } from './composables/useOnlineToast';
import { usePlaybackLyricsRuntime } from './composables/usePlaybackLyricsRuntime';
import { usePlaybackSessionRuntime } from './composables/usePlaybackSessionRuntime';
import { usePlaybackRuntimeState } from './composables/usePlaybackRuntimeState';
import { usePlayerErrorToast } from './composables/usePlayerErrorToast';
import { usePlaylistActions } from './composables/usePlaylistActions';
import { useScanFolders } from './composables/useScanFolders';
import { useAppShellState } from './composables/useAppShellState';
import { useSidebarCollapse } from './composables/useSidebarCollapse';
import { useTrackInteractionActions } from './composables/useTrackInteractionActions';
import { useTrackMetadataDialog } from './composables/useTrackMetadataDialog';
import { useTrayIntegration } from './composables/useTrayIntegration';
import { useWindowDrag } from './composables/useWindowDrag';
import { changeRustBackendQueueTrackQuality } from './services/playerBackend';
import { usePlayerStore } from './stores/player';
import type { PlaylistContextMenuListeners, TrackContextMenuListeners } from './types/appContextMenus';
import type { AppDialogsListeners } from './types/appDialogs';
import type { AppSidebarOutletListeners, AppSidebarOutletProps } from './types/sidebar';
import type { PlayerDockController } from './types/playerDockController';
import {
  dedupePlaybackQueue,
  isRemoteTrack,
} from './utils/playback';

const player = usePlayerStore();
const isAppReady = ref(false);
const appPlayerSurfaceRef = ref<{ getController: () => PlayerDockController | null } | null>(null);
const { activeRenderer: activeLyricsRenderer } = useLyricsRendererSettings();
const lyricsRendererOwnsSurface = computed(() => Boolean(activeLyricsRenderer.value?.ownsSurface));
type AppRustPlaybackRuntime = ReturnType<typeof useAppRustPlaybackRuntime>;
let appRustPlaybackRuntime: AppRustPlaybackRuntime;
const startRustPlaybackQueue = (...args: Parameters<AppRustPlaybackRuntime['startRustPlaybackQueue']>) => appRustPlaybackRuntime.startRustPlaybackQueue(...args);
const restoreRustPlaybackQueue = (...args: Parameters<AppRustPlaybackRuntime['restoreRustPlaybackQueue']>) => appRustPlaybackRuntime.restoreRustPlaybackQueue(...args);
const handleRustQueueSnapshot = (...args: Parameters<AppRustPlaybackRuntime['handleRustQueueSnapshot']>) => appRustPlaybackRuntime.handleRustQueueSnapshot(...args);
const getIsRestoringPlaybackQueue = () => appRustPlaybackRuntime.getIsRestoringPlaybackQueue();
const playNextTrack = () => appRustPlaybackRuntime.playNextTrack();
const playPreviousTrack = () => appRustPlaybackRuntime.playPreviousTrack();
const handlePlaybackFailure = (...args: Parameters<AppRustPlaybackRuntime['handlePlaybackFailure']>) => appRustPlaybackRuntime.handlePlaybackFailure(...args);
const removeTrackFromRustQueue = (...args: Parameters<AppRustPlaybackRuntime['removeTrackFromRustQueue']>) => appRustPlaybackRuntime.removeTrackFromRustQueue(...args);
const setPlaybackMode = (...args: Parameters<AppRustPlaybackRuntime['setPlaybackMode']>) => appRustPlaybackRuntime.setPlaybackMode(...args);
const togglePlaybackMode = () => appRustPlaybackRuntime.togglePlaybackMode();
const { isSidebarCollapsed } = useSidebarCollapse();
const { startWindowDrag } = useWindowDrag();
const {
  closeLyricsView,
  finishLyricsEnter,
  isLibraryVisible,
  isLyricsOpen,
  isLyricsTransitioning,
  showLibraryAfterLyricsLeave,
  toggleLyricsView,
} = useLyricsViewVisibility();
const {
  isAudioPlaying,
  playbackTime,
  seekRequestId,
  seekTime,
  togglePlaybackRequestId,
  updatePlaybackRunningState,
  updatePlaybackTime,
} = usePlaybackRuntimeState();
const requestPlaybackToggle = () => {
  togglePlaybackRequestId.value += 1;
};
const {
  closeOnlineToast,
  onlineToastMessage,
  onlineToastVariant,
  showOnlineToast,
} = useOnlineToast();
usePlayerErrorToast({
  player,
  showToast: showOnlineToast,
});
const RUST_CROSSFADE_DURATION_MS = 3000;

const {
  clearOnlineSearchError,
  isOnlineSearchOpen,
  onlineSearchError,
  onlineSearchResults,
  resetOnlineSearchSnapshot,
  setOnlineSearchError,
  updateOnlineSearchSnapshot,
} = useOnlineSearchSnapshotBridge();
const {
  appGridStyle,
  isResizingLibraryPanel,
  loadLibraryPanelWidth,
  startLibraryPanelResize,
} = useLibraryPanelResize();

let getDefaultArtistName = () => null as string | null;
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
} = useLibraryNavigation(() => getDefaultArtistName());

const {
  hasThemeBackground,
  shouldShowLibraryResizeHandle,
} = useAppShellState({
  activeCollection,
  activeView,
  isLibraryPanelMode,
  player,
});

const {
  artistGroups,
  libraryMeta,
  libraryTitle,
  localFolderTrackCount,
  localFolders,
  recentAddedTrackCount,
  visibleTracks,
} = useLibraryCatalog({
  activeCollection,
  activeFolderPath,
  activeLibraryFilter,
  activePlaylistId,
  player,
});
getDefaultArtistName = () => artistGroups.value[0]?.name ?? null;

const {
  addToPlaylistTrack,
  addTrackToPlaylist,
  chooseExistingPlaylistCover,
  closeAddToPlaylistDialog,
  closeContextMenus,
  closeCreatePlaylistDialog,
  confirmCreatePlaylist,
  deletePlaylist,
  editingPlaylistId,
  isPlaylistDialogOpen,
  choosePlaylistCover,
  clearPlaylistCover,
  newPlaylistCover,
  closePlaylistCoverCropDialog,
  isSavingPlaylistCoverCrop,
  newPlaylistName,
  openAddToPlaylistDialog,
  openCreatePlaylistDialog,
  openCreatePlaylistFromAddDialog,
  openPlaylistContextMenu,
  openTrackContextMenu,
  openTrackFolder,
  playlistContextMenu,
  playlistCoverCropImagePath,
  queueTrackLast,
  queueTrackNext,
  removeTrackFromActivePlaylist,
  savePlaylistCoverCrop,
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

const {
  clearDownloadedItemRecord,
  deleteDownloadedItem,
  downloadItems,
  downloadedTrackKeys,
  downloadTrack,
  handleDownloadQueueEvent,
  isTrackDownloaded,
  isTrackDownloadPending,
  loadDownloadItems,
  openDownloadedItemFolder,
  pauseDownloadItem,
  pendingDownloadTrackKeys,
  resumeDownloadItem,
  retryDownloadItem,
} = useDownloadController({
  closeContextMenus,
  showToast: showOnlineToast,
});
const shouldShowDownloadsMenu = computed(() => player.settings.enablePlugins || downloadItems.value.length > 0);
const { hasMusicSourcePlugin } = useMusicSourcePluginAvailability(computed(() => player.settings.enablePlugins));

const {
  activeTrack,
  clearPreparingPlaybackState,
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
  handleOnlineSearchStarted,
  openDiscoverMusicView,
  openLocalFolderFromPanel,
  openRecentAddedFromPanel,
  returnToLocalLibrary,
} = useContentNavigationActions({
  hasMusicSourcePlugin,
  pluginsEnabled: computed(() => player.settings.enablePlugins),
  onlineResolvingTrackKey,
  openDiscoverView,
  openFolder,
  openLibraryView,
  openRecentAddedInLibrary,
  resetOnlineSearchSnapshot,
});

useNavigationAvailabilityGuards({
  activeView,
  hasMusicSourcePlugin,
  pluginsEnabled: computed(() => player.settings.enablePlugins),
  returnToLocalLibrary,
  shouldShowDownloadsMenu,
});

const {
  buildOnlinePlaybackQueue,
  clearQueueSwitchingForTrack,
  findPluginTrackForQueueTrack,
  getOnlineTrackKey,
} = useOnlinePlaybackLookup({
  activePluginTrack: onlineActivePluginTrack,
  dedupeTracks: dedupePlaybackQueue,
  onlineSearchResults,
  queueSwitchingTrackKey,
});

const {
  openOnlineTrackContextMenu,
  queueTrackNextFromContext,
  selectTrack,
} = useTrackInteractionActions({
  selectedTrack,
  closeContextMenus,
  findPluginTrackForQueueTrack,
  openTrackContextMenu,
  queueTrackNext,
});

const {
  addDownloadedTrackToPlaylist,
  downloadActiveOnlineTrack,
  playDownloadedTrack,
  queueDownloadedTrackNext,
} = useDownloadedTrackActions({
  downloadItems,
  downloadTrack,
  getActiveDownloadOptions: () => ({
    preferredQuality: onlinePlaybackQuality.value || null,
    lyricFormat: playbackLyricFormat.value || null,
    trackLyrics: playbackLyricMetadata.value ?? onlineActiveTrack.value?.associatedLyrics ?? onlineActiveTrack.value?.lyrics ?? null,
  }),
  onlineActiveTrack,
  openAddToPlaylistDialog,
  queueTrackNext,
  rustPlaybackQueue,
  startRustPlaybackQueue,
});

const {
  addTrackToFavorites,
  isActiveTrackFavorite,
  toggleFavoriteForTrack,
  toggleFavoriteTrack,
} = useFavoriteTrackActions({
  activeCollection,
  activePlaylistId,
  activeTrack,
  closeContextMenus,
  player,
  removeTrackFromRustQueue,
});

const {
  onlinePlaybackQuality,
  onlinePlaybackQualityOptions,
} = useOnlineQualityRefresh({
  activePluginTrack: onlineActivePluginTrack,
});

const {
  changeOnlinePlaybackQuality,
  playOnlineTrack,
} = useOnlinePlaybackController({
  player,
  playbackTime,
  rustPlaybackQueue,
  onlineActiveTrack,
  onlineActivePluginTrack,
  onlinePlaybackSource,
  onlineResolvingTrackKey,
  onlinePlaybackQuality,
  onlinePlaybackQualityOptions,
  buildOnlinePlaybackQueue,
  changeRustQueueTrackQuality: changeRustBackendQueueTrackQuality,
  clearOnlineSearchError,
  getOnlineTrackKey,
  handleRustQueueSnapshot,
  handlePlaybackFailure,
  setOnlineSearchError,
  startRustPlaybackQueue,
});

const {
  playFavoriteTracks,
  playQueueTrack,
  playTrack,
} = useLocalPlaybackActions({
  player,
  rustPlaybackQueue,
  visibleTracks,
  startRustPlaybackQueue,
});

const {
  hideLyricsDock,
  hoverLyricsDock,
  isLyricsDockHidden,
  isLyricsDockManuallyHidden,
  leaveLyricsDock,
  showLyricsDock,
  shouldAutoHideLyricsDock,
} = useLyricsDockAutoHide({
  activeTrack,
  autoHideEnabled: computed(() => player.settings.autoHideLyricsDock),
  isAudioPlaying,
  isLyricsOpen,
});

const {
  activeLyricsViewStatus,
  broadcastCurrentDesktopLyricsState,
  changeLyricFormat,
  clearActiveTrackLyrics,
  loadLocalTrackLyricsInBackground,
  loadPlaybackTrackLyricsInBackground,
  lyricsViewState,
  openDesktopLyrics,
  playbackLyricFormat,
  playbackLyricFormats,
  playbackLyricMetadata,
  syncLyricsViewStateForTrack,
  toggleDesktopLyrics,
  updateActiveTrackLyrics,
} = usePlaybackLyricsRuntime({
  activeTrack,
  currentPlaybackTrack,
  getOnlineTrackKey,
  isAudioPlaying,
  isRemoteTrack,
  onlineActiveTrack,
  onlineActiveTrackKey,
  playbackTime,
  player,
  rustPlaybackQueue,
  selectedTrack,
  showToast: showOnlineToast,
});
const {
  canChangeTrackCover,
  canEditTrackMetadata,
  canRefreshTrackDuration,
  isActiveOnlineTrackDownloaded,
  isActiveOnlineTrackDownloading,
  shouldShowActiveTrackDownload,
  shouldShowLyricFormat,
} = useActiveTrackUiState({
  activeCollection,
  activeLibraryFilter,
  activePlaylistId,
  activeTrack,
  activeView,
  onlineActivePluginTrack,
  onlineActiveTrack,
  playbackLyricFormats,
  pluginsEnabled: computed(() => player.settings.enablePlugins),
  trackMetadataEditingEnabled: computed(() => player.settings.enableTrackMetadataEdit),
  trackCoverEditingEnabled: computed(() => player.settings.enableTrackCoverEdit),
  trackDurationRefreshEnabled: computed(() => player.settings.enableTrackDurationRefresh),
  findPluginTrackForQueueTrack,
  isRemoteTrack,
  isTrackDownloaded,
  isTrackDownloadPending,
});

const {
  applyTrackCoverRefresh,
  changeTrackCover,
  closeCoverCropDialog,
  closeTrackMetadataDialog,
  coverCropImagePath,
  coverCropTrack,
  isSavingCoverCrop,
  isSavingTrackMetadata,
  metadataEditingTrack,
  openTrackMetadataDialog,
  refreshLocalTrackDuration,
  saveCoverCrop,
  saveTrackMetadata,
  trackMetadataError,
} = useTrackMetadataDialog({
  canChangeTrackCover,
  canEditTrackMetadata,
  canRefreshTrackDuration,
  closeContextMenus,
  currentPlaybackTrack,
  isAudioPlaying,
  onlineActiveTrack,
  player,
  rustPlaybackQueue,
  selectedTrack,
  showToast: showOnlineToast,
});

const {
  restorePlaybackRequestId,
  restorePlaybackTime,
  restoreSavedPlaybackSession,
  savePlaybackSessionNow,
} = usePlaybackSessionRuntime({
  activeTrack,
  playbackQueue: rustPlaybackQueue,
  playbackTime,
  player,
  selectedTrack,
});

appRustPlaybackRuntime = useAppRustPlaybackRuntime({
  currentPlaybackTrack,
  isAudioPlaying,
  onlineActivePluginTrack,
  onlineActiveTrack,
  onlineActiveTrackKey,
  onlinePlaybackSource,
  playbackTime,
  queueSwitchingTrackKey,
  restorePlaybackTime,
  rustPlaybackQueue,
  selectedTrack,
  player,
  clearPreparingPlaybackState,
  clearQueueSwitchingForTrack,
  dedupePlaybackQueue,
  findPluginTrackForQueueTrack,
  getOnlineTrackKey,
  loadLocalTrackLyricsInBackground,
  loadPlaybackTrackLyricsInBackground,
  showToast: showOnlineToast,
  syncLyricsViewStateForTrack,
  crossfadeDurationMs: RUST_CROSSFADE_DURATION_MS,
});

const { rustQueueSnapshotController } = appRustPlaybackRuntime;

const {
  playActiveTrack,
  seekToLyric,
} = useActivePlaybackSeekActions({
  activeTrack,
  rustPlaybackQueue,
  seekRequestId,
  seekTime,
  visibleTracks,
  player,
  clearPreparingPlaybackState,
  showToast: showOnlineToast,
  startRustPlaybackQueue,
});

const {
  handleTrayMenuAction,
  startDesktopLyricsActionListener,
  startDesktopLyricsReadyListener,
  startDownloadEventListener,
  startRustQueueEventListener,
} = useExternalPlaybackEventBridge({
  togglePlaybackRequestId,
  broadcastCurrentDesktopLyricsState,
  getIsRestoringPlaybackQueue,
  handleDownloadQueueEvent,
  handleRustQueueSnapshot,
  openSettingsView,
  playNextTrack,
  playPreviousTrack,
  setPlaybackMode,
});

useLocalLibraryQueuePruning({
  currentPlaybackTrack,
  libraryTracks: computed(() => player.tracks),
  onRemovedActiveLocalTrack: rustQueueSnapshotController.clearActivePlaybackState,
  onRustQueueSnapshot: handleRustQueueSnapshot,
  rustPlaybackQueue,
  selectedTrack,
  showToast: showOnlineToast,
});

useAppBootstrap({
  dedupePlaybackQueue,
  isAppReady,
  loadDownloadItems,
  loadLibraryPanelWidth,
  player,
  restoreRustPlaybackQueue,
  restoreSavedPlaybackSession,
  rustPlaybackQueue,
  startDesktopLyricsActionListener,
  startDesktopLyricsReadyListener,
  startDownloadEventListener,
  startRustQueueEventListener,
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



const { handleAppCloseRequest } = useTrayIntegration({
  activeTrack,
  handleTrayMenuAction,
  isAudioPlaying,
  player,
  savePlaybackSessionNow,
});

const appMenuSurfaceProps = computed<AppSidebarOutletProps>(() => ({
  activeCollection: activeCollection.value,
  activeLibraryFilter: activeLibraryFilter.value,
  activePlaylistId: activePlaylistId.value,
  activeView: activeView.value,
  collapsed: isSidebarCollapsed.value,
  enablePlugins: player.settings.enablePlugins,
  hasMusicSourcePlugin: hasMusicSourcePlugin.value,
  isLibraryPanelMode: isLibraryPanelMode.value,
  playlists: player.settings.playlists ?? [],
  showDownloads: shouldShowDownloadsMenu.value,
}));

const appMenuSurfaceListeners: AppSidebarOutletListeners = {
  onCreatePlaylist: openCreatePlaylistDialog,
  onOpenArtists: openArtistsView,
  onOpenDiscover: openDiscoverMusicView,
  onOpenDownloads: openDownloadsView,
  onOpenFavorites: openFavoritesView,
  onOpenLibrary: returnToLocalLibrary,
  onOpenPlaylist: openPlaylistView,
  onOpenPlaylistMenu: openPlaylistContextMenu,
  onOpenPlugins: openPluginsView,
  onOpenRecentAdded: openRecentAdded,
  onOpenRecentPlayed: openRecentPlayed,
  onOpenSettings: openSettingsView,
  onOpenTheme: openThemeView,
  onToggleCollapsed: () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  },
};

const { appMainContentListeners, appMainContentProps } = useAppMainContentSurfaceBindings({
  player,
  state: {
    activeArtistName,
    activeCollection,
    activeFolderPath,
    activeLibraryFilter,
    activePlaylistId,
    activeTrack,
    activeView,
    appGridStyle,
    artistGroups,
    downloadedTrackKeys,
    downloadItems,
    isAudioPlaying,
    isLibraryPanelMode,
    isLibraryVisible,
    isOnlineSearchOpen,
    isPreparingActiveTrack,
    isResizingLibraryPanel,
    isSidebarCollapsed,
    libraryMeta,
    libraryTitle,
    localFolderTrackCount,
    localFolders,
    onlineActiveTrackKey,
    onlinePreparingTrackKey,
    onlineSearchError,
    pendingDownloadTrackKeys,
    recentAddedTrackCount,
    shouldShowDownloadsMenu,
    shouldShowLibraryResizeHandle,
    visibleTracks,
  },
  actions: {
    addDownloadedTrackToPlaylist,
    changePlaylistCover: chooseExistingPlaylistCover,
    chooseFolder,
    clearDownloadedItemRecord,
    deleteDownloadedItem,
    downloadTrack,
    handleOnlineSearchStarted,
    openArtistFromTrack,
    openArtistsView,
    openCreatePlaylistDialog,
    openDiscoverMusicView,
    openDownloadedItemFolder,
    openDownloadsView,
    openFavoritesView,
    openLocalFolderFromPanel,
    openOnlineTrackContextMenu,
    openPlaylistContextMenu,
    openPlaylistView,
    openPluginsView,
    openRecentAdded,
    openRecentAddedFromPanel,
    openRecentPlayed,
    openScanDialog,
    openSettingsView,
    openThemeView,
    openTrackContextMenu,
    pauseDownloadItem,
    playDownloadedTrack,
    playFavoriteTracks,
    playOnlineTrack,
    playTrack,
    queueDownloadedTrackNext,
    resumeDownloadItem,
    retryDownloadItem,
    returnToLocalLibrary,
    selectArtist,
    selectTrack,
    showOnlineToast,
    startLibraryPanelResize,
    toggleFavoriteForTrack,
    updateOnlineSearchSnapshot,
  },
});

const {
  lyricsViewListeners,
  lyricsViewProps,
  playerDockListeners,
  playerDockProps,
} = useAppPlayerSurfaceBindings({
  player,
  state: {
    activeLyricsViewStatus,
    activeTrack,
    currentPlaybackSource,
    isActiveOnlineTrackDownloaded,
    isActiveOnlineTrackDownloading,
    isActiveTrackFavorite,
    isAudioPlaying,
    isLyricsDockManuallyHidden,
    isLyricsOpen,
    isPreparingActiveTrack,
    lyricsError: computed(() => lyricsViewState.value.error),
    onlinePlaybackQuality,
    onlinePlaybackQualityOptions,
    playbackLyricFormat,
    playbackLyricFormats,
    playbackLyricMetadata,
    playbackTime,
    restorePlaybackRequestId,
    restorePlaybackTime,
    rustPlaybackQueue,
    seekRequestId,
    seekTime,
    shouldShowActiveTrackDownload,
    shouldShowLyricFormat,
    shouldShowOnlineQuality,
    togglePlaybackRequestId,
  },
  actions: {
    applyTrackCoverRefresh,
    changeLyricFormat,
    changeOnlinePlaybackQuality,
    clearActiveTrackLyrics,
    closeLyricsView,
    downloadActiveOnlineTrack,
    handlePlaybackFailure,
    hideLyricsDock,
    hoverLyricsDock,
    leaveLyricsDock,
    openDesktopLyrics,
    openSettingsView,
    toggleDesktopLyrics,
    playActiveTrack,
    playNextTrack,
    playPreviousTrack,
    playQueueTrack,
    seekToLyric,
    showLyricsDock,
    showOnlineToast,
    toggleFavoriteTrack,
    requestPlaybackToggle,
    toggleLyricsView,
    togglePlaybackMode,
    updateActiveTrackLyrics,
    updatePlaybackRunningState,
    updatePlaybackTime,
  },
  handleSeamlessAdvance: rustQueueSnapshotController.handleSeamlessAdvance,
});

const lyricsViewPropsWithPlayerDock = computed(() => ({
  ...lyricsViewProps.value,
  playerDockController: appPlayerSurfaceRef.value?.getController() ?? null,
}));

const { appDialogsListeners, appDialogsProps } = useAppDialogsBindings({
  props: {
    addToPlaylistTrack: () => addToPlaylistTrack.value,
    coverCropImagePath: () => coverCropImagePath.value,
    coverCropTrack: () => coverCropTrack.value,
    editingPlaylistId: () => editingPlaylistId.value,
    isCancelingScan: () => isCancelingScan.value,
    isConfirmingScan: () => isConfirmingScan.value,
    isPlaylistDialogOpen: () => isPlaylistDialogOpen.value,
    isSavingCoverCrop: () => isSavingCoverCrop.value,
    isSavingPlaylistCoverCrop: () => isSavingPlaylistCoverCrop.value,
    isSavingTrackMetadata: () => isSavingTrackMetadata.value,
    isScanDialogOpen: () => isScanDialogOpen.value,
    locale: () => player.settings.locale,
    metadataEditingTrack: () => metadataEditingTrack.value,
    newPlaylistCover: () => newPlaylistCover.value,
    newPlaylistName: () => newPlaylistName.value,
    playlistCoverCropImagePath: () => playlistCoverCropImagePath.value,
    playlists: () => player.settings.playlists,
    scanFolders: () => scanFolders.value,
    scanProgressText: () => scanProgressText.value,
    trackMetadataError: () => trackMetadataError.value,
    tracksForPlaylist: () => tracksForPlaylist,
  },
  listeners: {
    onAddScanFolder: addScanFolder,
    onAddTrackToPlaylist: addTrackToPlaylist,
    onCancelScanFolders: cancelScanFolders,
    onChangePlaylistName: (value) => {
      newPlaylistName.value = value;
    },
    onChoosePlaylistCover: choosePlaylistCover,
    onClearPlaylistCover: clearPlaylistCover,
    onCloseAddToPlaylistDialog: closeAddToPlaylistDialog,
    onCloseCoverCropDialog: closeCoverCropDialog,
    onCloseCreatePlaylistDialog: closeCreatePlaylistDialog,
    onClosePlaylistCoverCropDialog: closePlaylistCoverCropDialog,
    onCloseScanDialog: closeScanDialog,
    onCloseTrackMetadataDialog: closeTrackMetadataDialog,
    onConfirmCreatePlaylist: confirmCreatePlaylist,
    onConfirmScanFolders: confirmScanFolders,
    onOpenCreatePlaylistFromAddDialog: openCreatePlaylistFromAddDialog,
    onRemoveScanFolder: removeScanFolder,
    onSaveTrackMetadata: saveTrackMetadata,
    onSaveCoverCrop: saveCoverCrop,
    onSavePlaylistCoverCrop: savePlaylistCoverCrop,
    onUpdateScanFolderChecked: updateScanFolderChecked,
  } satisfies AppDialogsListeners,
});

const {
  playlistContextMenuListeners,
  playlistContextMenuProps,
  trackContextMenuListeners,
  trackContextMenuProps,
} = useAppContextMenuBindings({
  playlist: {
    locale: () => player.settings.locale,
    menu: () => playlistContextMenu.value,
    listeners: {
      onRename: startRenamePlaylist,
      onDelete: deletePlaylist,
    } satisfies PlaylistContextMenuListeners,
  },
  track: {
    activePlaylistId: () => activePlaylistId.value,
    canChangeCover: () => canChangeTrackCover.value,
    canEditMetadata: () => canEditTrackMetadata.value,
    canRefreshDuration: () => canRefreshTrackDuration.value,
    isDownloaded: (menu) => isTrackDownloaded(menu.track),
    isFavorite: (menu) => player.isFavorite(menu.track),
    locale: () => player.settings.locale,
    menu: () => trackContextMenu.value,
    listeners: {
      onQueueNext: queueTrackNextFromContext,
      onQueueLast: queueTrackLast,
      onAddToFavorite: addTrackToFavorites,
      onAddToPlaylist: openAddToPlaylistDialog,
      onDownloadTrack: downloadTrack,
      onEditMetadata: openTrackMetadataDialog,
      onChangeCover: changeTrackCover,
      onRefreshDuration: refreshLocalTrackDuration,
      onRemoveFromPlaylist: removeTrackFromActivePlaylist,
      onOpenFolder: openTrackFolder,
    } satisfies TrackContextMenuListeners,
  },
});

</script>

<template>
  <AppShellLayout
    :has-theme-background="hasThemeBackground"
    :lyrics-open="isLyricsOpen"
    :lyrics-transitioning="isLyricsTransitioning"
    :sidebar-collapsed="isSidebarCollapsed"
    @close-context-menus="closeContextMenus"
    @start-window-drag="startWindowDrag"
  >
    <template #overlays>
      <WindowControls class="floating-window-controls" @request-close="handleAppCloseRequest" />

      <AppStartupLoading v-if="!isAppReady" />

      <template v-else>
        <PlaylistContextMenu
          v-if="playlistContextMenuProps"
          v-bind="{ ...playlistContextMenuProps, ...playlistContextMenuListeners }"
        />

        <TrackContextMenu
          v-if="trackContextMenuProps"
          v-bind="{ ...trackContextMenuProps, ...trackContextMenuListeners }"
        />

        <AppDialogs
          v-bind="{ ...appDialogsProps, ...appDialogsListeners }"
        />

        <Transition name="lyrics-slide" @after-enter="finishLyricsEnter" @after-leave="showLibraryAfterLyricsLeave">
          <LyricsView
            v-if="activeTrack"
            v-show="isLyricsOpen"
            v-bind="{ ...lyricsViewPropsWithPlayerDock, ...lyricsViewListeners }"
          />
        </Transition>

        <LyricsDockHotZone
          v-if="shouldAutoHideLyricsDock && !lyricsRendererOwnsSurface"
          @hover="hoverLyricsDock"
        />

        <AppOnlineToast :message="onlineToastMessage" :variant="onlineToastVariant" @close="closeOnlineToast" />
      </template>
    </template>

    <template v-if="isAppReady" #menu>
      <AppMenuSurface
        :listeners="appMenuSurfaceListeners"
        :props="appMenuSurfaceProps"
      />
    </template>

    <template v-if="isAppReady" #content>
      <AppMainContent
        v-bind="{ ...appMainContentProps, ...appMainContentListeners }"
      />
    </template>

    <template v-if="isAppReady" #dock>
      <AppPlayerSurface
        ref="appPlayerSurfaceRef"
        :hidden="isLyricsDockHidden || (isLyricsOpen && lyricsRendererOwnsSurface)"
        :listeners="playerDockListeners"
        :props="playerDockProps"
      />
    </template>
  </AppShellLayout>
</template>
