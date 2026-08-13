import { computed } from 'vue';
import type { AppMainContentEmits, AppMainContentProps } from '../types/appMainContent';
import type { AppPageOutletProps } from '../types/appPageOutlet';
import type { AppSidebarOutletListeners } from '../types/sidebar';

type AppMainContentEmit = <K extends keyof AppMainContentEmits>(event: K, ...args: AppMainContentEmits[K]) => void;

export function useAppMainContentOutletBindings(props: AppMainContentProps, emit: AppMainContentEmit) {
  const pageOutletProps = computed<AppPageOutletProps>(() => ({
    activeArtistName: props.activeArtistName,
    activeCollection: props.activeCollection,
    activeFolderPath: props.activeFolderPath,
    activeLibraryFilter: props.activeLibraryFilter,
    activePlaylistId: props.activePlaylistId,
    activeTrack: props.activeTrack,
    activeView: props.activeView,
    artistGroups: props.artistGroups,
    downloadedTrackKeys: props.downloadedTrackKeys,
    downloadItems: props.downloadItems,
    favoriteTrackIds: props.favoriteTrackIds,
    isAudioPlaying: props.isAudioPlaying,
    isLibraryPanelMode: props.isLibraryPanelMode,
    isOnlineSearchOpen: props.isOnlineSearchOpen,
    isPreparingActiveTrack: props.isPreparingActiveTrack,
    libraryMeta: props.libraryMeta,
    libraryTitle: props.libraryTitle,
    localFolderTrackCount: props.localFolderTrackCount,
    localFolders: props.localFolders,
    onlineActiveTrackKey: props.onlineActiveTrackKey,
    onlinePreparingTrackKey: props.onlinePreparingTrackKey,
    onlineSearchError: props.onlineSearchError,
    pendingDownloadTrackKeys: props.pendingDownloadTrackKeys,
    playerError: props.playerError,
    playerQuery: props.playerQuery,
    recentAddedTrackCount: props.recentAddedTrackCount,
    visibleTracks: props.visibleTracks,
  }));

  const sidebarOutletListeners: AppSidebarOutletListeners = {
    onCreatePlaylist: () => emit('createPlaylist'),
    onOpenArtists: () => emit('openArtistsView'),
    onOpenDiscover: () => emit('openDiscoverMusicView'),
    onOpenDownloads: () => emit('openDownloadsView'),
    onOpenFavorites: () => emit('openFavoritesView'),
    onOpenLibrary: () => emit('returnToLocalLibrary'),
    onOpenPlaylist: (...args) => emit('openPlaylistView', ...args),
    onOpenPlaylistMenu: (...args) => emit('openPlaylistContextMenu', ...args),
    onOpenPlugins: () => emit('openPluginsView'),
    onOpenRecentAdded: () => emit('openRecentAdded'),
    onOpenRecentPlayed: () => emit('openRecentPlayed'),
    onOpenSettings: () => emit('openSettingsView'),
    onOpenTheme: () => emit('openThemeView'),
    onToggleCollapsed: () => emit('toggleSidebarCollapsed'),
  };

  const pageOutletListeners = {
    onAddDownloadedTrackToPlaylist: (...args: AppMainContentEmits['addDownloadedTrackToPlaylist']) => emit('addDownloadedTrackToPlaylist', ...args),
    onChooseFolder: () => emit('chooseFolder'),
    onClearDownloadedItemRecord: (...args: AppMainContentEmits['clearDownloadedItemRecord']) => emit('clearDownloadedItemRecord', ...args),
    onChangePlaylistCover: (...args: AppMainContentEmits['changePlaylistCover']) => emit('changePlaylistCover', ...args),
    onDeleteDownloadedItem: (...args: AppMainContentEmits['deleteDownloadedItem']) => emit('deleteDownloadedItem', ...args),
    onDownloadTrack: (...args: AppMainContentEmits['downloadTrack']) => emit('downloadTrack', ...args),
    onNotify: (...args: AppMainContentEmits['notify']) => emit('notify', ...args),
    onOnlineSearchStarted: () => emit('onlineSearchStarted'),
    onOnlineSearchUpdated: (...args: AppMainContentEmits['onlineSearchUpdated']) => emit('onlineSearchUpdated', ...args),
    onOpenArtistFromTrack: (...args: AppMainContentEmits['openArtistFromTrack']) => emit('openArtistFromTrack', ...args),
    onOpenDownloadedItemFolder: (...args: AppMainContentEmits['openDownloadedItemFolder']) => emit('openDownloadedItemFolder', ...args),
    onOpenLocalFolderFromPanel: (...args: AppMainContentEmits['openLocalFolderFromPanel']) => emit('openLocalFolderFromPanel', ...args),
    onOpenOnlineTrackContextMenu: (...args: AppMainContentEmits['openOnlineTrackContextMenu']) => emit('openOnlineTrackContextMenu', ...args),
    onOpenRecentAddedFromPanel: () => emit('openRecentAddedFromPanel'),
    onOpenScanDialog: () => emit('openScanDialog'),
    onOpenTrackContextMenu: (...args: AppMainContentEmits['openTrackContextMenu']) => emit('openTrackContextMenu', ...args),
    onPauseDownloadItem: (...args: AppMainContentEmits['pauseDownloadItem']) => emit('pauseDownloadItem', ...args),
    onPlayDownloadedTrack: (...args: AppMainContentEmits['playDownloadedTrack']) => emit('playDownloadedTrack', ...args),
    onPlayFavoriteTracks: () => emit('playFavoriteTracks'),
    onPlayOnlineTrack: (...args: AppMainContentEmits['playOnlineTrack']) => emit('playOnlineTrack', ...args),
    onPlayTrack: (...args: AppMainContentEmits['playTrack']) => emit('playTrack', ...args),
    onQueueDownloadedTrackNext: (...args: AppMainContentEmits['queueDownloadedTrackNext']) => emit('queueDownloadedTrackNext', ...args),
    onRescanLibrary: () => emit('rescanLibrary'),
    onResumeDownloadItem: (...args: AppMainContentEmits['resumeDownloadItem']) => emit('resumeDownloadItem', ...args),
    onRetryDownloadItem: (...args: AppMainContentEmits['retryDownloadItem']) => emit('retryDownloadItem', ...args),
    onReturnToLocalLibrary: () => emit('returnToLocalLibrary'),
    onSelectArtist: (...args: AppMainContentEmits['selectArtist']) => emit('selectArtist', ...args),
    onSelectTrack: (...args: AppMainContentEmits['selectTrack']) => emit('selectTrack', ...args),
    onToggleFavoriteForTrack: (...args: AppMainContentEmits['toggleFavoriteForTrack']) => emit('toggleFavoriteForTrack', ...args),
    onUpdatePlayerQuery: (...args: AppMainContentEmits['updatePlayerQuery']) => emit('updatePlayerQuery', ...args),
  };

  return {
    pageOutletListeners,
    pageOutletProps,
    sidebarOutletListeners,
  };
}
