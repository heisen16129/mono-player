import type { Ref, StyleValue } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { AppMainContentListeners, AppMainContentProps } from '../types/appMainContent';
import type { ArtistGroup, LocalFolderItem } from '../types/library';
import type { DownloadItem, Track } from '../types/music';
import type { AppView, LibraryCollection, LibraryFilter } from './useLibraryNavigation';
import { useAppMainContentBindings } from './useAppMainContentBindings';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseAppMainContentSurfaceBindingsState {
  activeArtistName: ReadonlyRefValue<string | null>;
  activeCollection: ReadonlyRefValue<LibraryCollection>;
  activeFolderPath: ReadonlyRefValue<string | null>;
  activeLibraryFilter: ReadonlyRefValue<LibraryFilter>;
  activePlaylistId: ReadonlyRefValue<string | null>;
  activeTrack: ReadonlyRefValue<Track | null>;
  activeView: ReadonlyRefValue<AppView>;
  appGridStyle: ReadonlyRefValue<StyleValue>;
  artistGroups: ReadonlyRefValue<ArtistGroup[]>;
  downloadedTrackKeys: ReadonlyRefValue<string[]>;
  downloadItems: ReadonlyRefValue<DownloadItem[]>;
  isAudioPlaying: ReadonlyRefValue<boolean>;
  isLibraryPanelMode: ReadonlyRefValue<boolean>;
  isLibraryVisible: ReadonlyRefValue<boolean>;
  isOnlineSearchOpen: ReadonlyRefValue<boolean>;
  isPreparingActiveTrack: ReadonlyRefValue<boolean>;
  isResizingLibraryPanel: ReadonlyRefValue<boolean>;
  isSidebarCollapsed: Ref<boolean>;
  libraryMeta: ReadonlyRefValue<AppMainContentProps['libraryMeta']>;
  libraryTitle: ReadonlyRefValue<string>;
  localFolderTrackCount: ReadonlyRefValue<number>;
  localFolders: ReadonlyRefValue<LocalFolderItem[]>;
  onlineActiveTrackKey: ReadonlyRefValue<string | null>;
  onlinePreparingTrackKey: ReadonlyRefValue<string | null>;
  onlineSearchError: ReadonlyRefValue<string | null>;
  pendingDownloadTrackKeys: ReadonlyRefValue<string[]>;
  recentAddedTrackCount: ReadonlyRefValue<number>;
  shouldShowDownloadsMenu: ReadonlyRefValue<boolean>;
  shouldShowLibraryResizeHandle: ReadonlyRefValue<boolean>;
  visibleTracks: ReadonlyRefValue<Track[]>;
}

interface UseAppMainContentSurfaceBindingsActions {
  addDownloadedTrackToPlaylist: AppMainContentListeners['onAddDownloadedTrackToPlaylist'];
  changePlaylistCover: AppMainContentListeners['onChangePlaylistCover'];
  chooseFolder: AppMainContentListeners['onChooseFolder'];
  clearDownloadedItemRecord: AppMainContentListeners['onClearDownloadedItemRecord'];
  deleteDownloadedItem: AppMainContentListeners['onDeleteDownloadedItem'];
  downloadTrack: AppMainContentListeners['onDownloadTrack'];
  handleOnlineSearchStarted: AppMainContentListeners['onOnlineSearchStarted'];
  openArtistFromTrack: AppMainContentListeners['onOpenArtistFromTrack'];
  openArtistsView: AppMainContentListeners['onOpenArtistsView'];
  openCreatePlaylistDialog: AppMainContentListeners['onCreatePlaylist'];
  openDiscoverMusicView: AppMainContentListeners['onOpenDiscoverMusicView'];
  openDownloadedItemFolder: AppMainContentListeners['onOpenDownloadedItemFolder'];
  openDownloadsView: AppMainContentListeners['onOpenDownloadsView'];
  openFavoritesView: AppMainContentListeners['onOpenFavoritesView'];
  openLocalFolderFromPanel: AppMainContentListeners['onOpenLocalFolderFromPanel'];
  openOnlineTrackContextMenu: AppMainContentListeners['onOpenOnlineTrackContextMenu'];
  openPlaylistContextMenu: AppMainContentListeners['onOpenPlaylistContextMenu'];
  openPlaylistView: AppMainContentListeners['onOpenPlaylistView'];
  openPluginsView: AppMainContentListeners['onOpenPluginsView'];
  openRecentAdded: AppMainContentListeners['onOpenRecentAdded'];
  openRecentAddedFromPanel: AppMainContentListeners['onOpenRecentAddedFromPanel'];
  openRecentPlayed: AppMainContentListeners['onOpenRecentPlayed'];
  openScanDialog: AppMainContentListeners['onOpenScanDialog'];
  openSettingsView: AppMainContentListeners['onOpenSettingsView'];
  openThemeView: AppMainContentListeners['onOpenThemeView'];
  openTrackContextMenu: AppMainContentListeners['onOpenTrackContextMenu'];
  pauseDownloadItem: AppMainContentListeners['onPauseDownloadItem'];
  playDownloadedTrack: AppMainContentListeners['onPlayDownloadedTrack'];
  playFavoriteTracks: AppMainContentListeners['onPlayFavoriteTracks'];
  playOnlineTrack: AppMainContentListeners['onPlayOnlineTrack'];
  playTrack: AppMainContentListeners['onPlayTrack'];
  queueDownloadedTrackNext: AppMainContentListeners['onQueueDownloadedTrackNext'];
  resumeDownloadItem: AppMainContentListeners['onResumeDownloadItem'];
  retryDownloadItem: AppMainContentListeners['onRetryDownloadItem'];
  returnToLocalLibrary: AppMainContentListeners['onReturnToLocalLibrary'];
  selectArtist: AppMainContentListeners['onSelectArtist'];
  selectTrack: AppMainContentListeners['onSelectTrack'];
  showOnlineToast: AppMainContentListeners['onNotify'];
  startLibraryPanelResize: AppMainContentListeners['onStartLibraryPanelResize'];
  toggleFavoriteForTrack: AppMainContentListeners['onToggleFavoriteForTrack'];
  updateOnlineSearchSnapshot: AppMainContentListeners['onOnlineSearchUpdated'];
}

interface UseAppMainContentSurfaceBindingsOptions {
  player: ReturnType<typeof usePlayerStore>;
  state: UseAppMainContentSurfaceBindingsState;
  actions: UseAppMainContentSurfaceBindingsActions;
}

export function useAppMainContentSurfaceBindings({
  player,
  state,
  actions,
}: UseAppMainContentSurfaceBindingsOptions) {
  return useAppMainContentBindings({
    props: {
      activeArtistName: () => state.activeArtistName.value,
      activeCollection: () => state.activeCollection.value,
      activeFolderPath: () => state.activeFolderPath.value,
      activeLibraryFilter: () => state.activeLibraryFilter.value,
      activePlaylistId: () => state.activePlaylistId.value,
      activeTrack: () => state.activeTrack.value,
      activeView: () => state.activeView.value,
      appGridStyle: () => state.appGridStyle.value,
      artistGroups: () => state.artistGroups.value,
      downloadedTrackKeys: () => state.downloadedTrackKeys.value,
      downloadItems: () => state.downloadItems.value,
      enablePlugins: () => player.settings.enablePlugins,
      favoriteTrackIds: () => player.favoriteTrackIds,
      isAudioPlaying: () => state.isAudioPlaying.value,
      isLibraryPanelMode: () => state.isLibraryPanelMode.value,
      isLibraryVisible: () => state.isLibraryVisible.value,
      isOnlineSearchOpen: () => state.isOnlineSearchOpen.value,
      isPreparingActiveTrack: () => state.isPreparingActiveTrack.value,
      isResizingLibraryPanel: () => state.isResizingLibraryPanel.value,
      isSidebarCollapsed: () => state.isSidebarCollapsed.value,
      libraryMeta: () => state.libraryMeta.value,
      libraryTitle: () => state.libraryTitle.value,
      localFolderTrackCount: () => state.localFolderTrackCount.value,
      localFolders: () => state.localFolders.value,
      onlineActiveTrackKey: () => state.onlineActiveTrackKey.value,
      onlinePreparingTrackKey: () => state.onlinePreparingTrackKey.value,
      onlineSearchError: () => state.onlineSearchError.value,
      pendingDownloadTrackKeys: () => state.pendingDownloadTrackKeys.value,
      playerError: () => player.error,
      playerQuery: () => player.query,
      playlists: () => player.settings.playlists ?? [],
      recentAddedTrackCount: () => state.recentAddedTrackCount.value,
      shouldShowDownloadsMenu: () => state.shouldShowDownloadsMenu.value,
      shouldShowLibraryResizeHandle: () => state.shouldShowLibraryResizeHandle.value,
      visibleTracks: () => state.visibleTracks.value,
    },
    listeners: {
      onAddDownloadedTrackToPlaylist: actions.addDownloadedTrackToPlaylist,
      onChangePlaylistCover: actions.changePlaylistCover,
      onChooseFolder: actions.chooseFolder,
      onClearDownloadedItemRecord: actions.clearDownloadedItemRecord,
      onCreatePlaylist: actions.openCreatePlaylistDialog,
      onDeleteDownloadedItem: actions.deleteDownloadedItem,
      onDownloadTrack: actions.downloadTrack,
      onOpenArtistFromTrack: actions.openArtistFromTrack,
      onOpenArtistsView: actions.openArtistsView,
      onOpenDiscoverMusicView: actions.openDiscoverMusicView,
      onOpenDownloadedItemFolder: actions.openDownloadedItemFolder,
      onOpenDownloadsView: actions.openDownloadsView,
      onOpenFavoritesView: actions.openFavoritesView,
      onOpenLocalFolderFromPanel: actions.openLocalFolderFromPanel,
      onOpenOnlineTrackContextMenu: actions.openOnlineTrackContextMenu,
      onOpenPlaylistContextMenu: actions.openPlaylistContextMenu,
      onOpenPlaylistView: actions.openPlaylistView,
      onOpenPluginsView: actions.openPluginsView,
      onOpenRecentAdded: actions.openRecentAdded,
      onOpenRecentAddedFromPanel: actions.openRecentAddedFromPanel,
      onOpenRecentPlayed: actions.openRecentPlayed,
      onOpenScanDialog: actions.openScanDialog,
      onOpenSettingsView: actions.openSettingsView,
      onOpenThemeView: actions.openThemeView,
      onOpenTrackContextMenu: actions.openTrackContextMenu,
      onNotify: actions.showOnlineToast,
      onPauseDownloadItem: actions.pauseDownloadItem,
      onPlayDownloadedTrack: actions.playDownloadedTrack,
      onPlayFavoriteTracks: actions.playFavoriteTracks,
      onPlayOnlineTrack: actions.playOnlineTrack,
      onPlayTrack: actions.playTrack,
      onQueueDownloadedTrackNext: actions.queueDownloadedTrackNext,
      onRescanLibrary: () => player.scanLibrary(),
      onRetryDownloadItem: actions.retryDownloadItem,
      onResumeDownloadItem: actions.resumeDownloadItem,
      onReturnToLocalLibrary: actions.returnToLocalLibrary,
      onOnlineSearchStarted: actions.handleOnlineSearchStarted,
      onOnlineSearchUpdated: actions.updateOnlineSearchSnapshot,
      onSelectArtist: actions.selectArtist,
      onSelectTrack: actions.selectTrack,
      onStartLibraryPanelResize: actions.startLibraryPanelResize,
      onToggleFavoriteForTrack: actions.toggleFavoriteForTrack,
      onToggleSidebarCollapsed: () => {
        state.isSidebarCollapsed.value = !state.isSidebarCollapsed.value;
      },
      onUpdatePlayerQuery: (value) => {
        player.query = value;
      },
    },
  });
}
