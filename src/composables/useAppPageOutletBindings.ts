import { computed } from 'vue';
import type {
  AppArtistsPageOutletListeners,
  AppArtistsPageOutletProps,
  AppDiscoverPageOutletListeners,
  AppDiscoverPageOutletProps,
  AppDownloadsPageOutletListeners,
  AppDownloadsPageOutletProps,
  AppLibraryHomePageOutletListeners,
  AppLibraryHomePageOutletProps,
  AppPageOutletEmits,
  AppPageOutletProps,
  AppUtilityPageOutletListeners,
  AppUtilityPageOutletProps,
  AppWorkspacePageOutletListeners,
  AppWorkspacePageOutletProps,
} from '../types/appPageOutlet';

type AppPageOutletEmit = <K extends keyof AppPageOutletEmits>(event: K, ...args: AppPageOutletEmits[K]) => void;

export function useAppPageOutletBindings(props: AppPageOutletProps, emit: AppPageOutletEmit) {
  const libraryHomePageOutletProps = computed<AppLibraryHomePageOutletProps>(() => ({
    activeCollection: props.activeCollection,
    activeFolderPath: props.activeFolderPath,
    activeLibraryFilter: props.activeLibraryFilter,
    activePlaylistId: props.activePlaylistId,
    activeTrack: props.activeTrack,
    favoriteTrackIds: props.favoriteTrackIds,
    isAudioPlaying: props.isAudioPlaying,
    isOnlineSearchOpen: props.isOnlineSearchOpen,
    isPreparingActiveTrack: props.isPreparingActiveTrack,
    libraryMeta: props.libraryMeta,
    libraryTitle: props.libraryTitle,
    localFolderTrackCount: props.localFolderTrackCount,
    localFolders: props.localFolders,
    playbackSpectrumLevels: props.playbackSpectrumLevels,
    playerError: props.playerError,
    playerQuery: props.playerQuery,
    recentAddedTrackCount: props.recentAddedTrackCount,
    visibleTracks: props.visibleTracks,
  }));

  const libraryHomePageOutletListeners: AppLibraryHomePageOutletListeners = {
    onChooseFolder: () => emit('chooseFolder'),
    onOpenArtistFromTrack: (...args) => emit('openArtistFromTrack', ...args),
    onOpenLocalFolderFromPanel: (...args) => emit('openLocalFolderFromPanel', ...args),
    onOpenRecentAddedFromPanel: () => emit('openRecentAddedFromPanel'),
    onOpenScanDialog: () => emit('openScanDialog'),
    onOpenTrackContextMenu: (...args) => emit('openTrackContextMenu', ...args),
    onPlayFavoriteTracks: () => emit('playFavoriteTracks'),
    onPlayTrack: (...args) => emit('playTrack', ...args),
    onRescanLibrary: () => emit('rescanLibrary'),
    onReturnToLocalLibrary: () => emit('returnToLocalLibrary'),
    onSelectTrack: (...args) => emit('selectTrack', ...args),
    onToggleFavoriteForTrack: (...args) => emit('toggleFavoriteForTrack', ...args),
    onUpdatePlayerQuery: (...args) => emit('updatePlayerQuery', ...args),
  };

  const discoverPageOutletProps = computed<AppDiscoverPageOutletProps>(() => ({
    activePlaybackTrack: props.activeTrack,
    activeTrackKey: props.onlineActiveTrackKey,
    downloadedTrackKeys: props.downloadedTrackKeys,
    favoriteTrackIds: props.favoriteTrackIds,
    isPlaying: props.isAudioPlaying,
    pendingDownloadTrackKeys: props.pendingDownloadTrackKeys,
    resolvingTrackKey: props.onlinePreparingTrackKey,
    searchError: props.onlineSearchError,
    spectrumLevels: props.playbackSpectrumLevels,
  }));

  const discoverPageOutletListeners: AppDiscoverPageOutletListeners = {
    onBackLocal: () => emit('returnToLocalLibrary'),
    onDownloadTrack: (...args) => emit('downloadTrack', ...args),
    onNotify: (...args) => emit('notify', ...args),
    onOpenTrackMenu: (...args) => emit('openOnlineTrackContextMenu', ...args),
    onPlayTrack: (...args) => emit('playOnlineTrack', ...args),
    onSearchReady: (...args) => emit('onlineSearchUpdated', ...args),
    onSearchStarted: () => emit('onlineSearchStarted'),
    onSearchUpdated: (...args) => emit('onlineSearchUpdated', ...args),
    onToggleFavorite: (...args) => emit('toggleFavoriteForTrack', ...args),
  };

  const workspacePageOutletProps = computed<AppWorkspacePageOutletProps>(() => ({
    activeCollection: props.activeCollection,
    activePlaylistId: props.activePlaylistId,
    activeTrack: props.activeTrack,
    error: props.playerError,
    favoriteTrackIds: props.favoriteTrackIds,
    isPlaying: props.isAudioPlaying,
    isPreparingActiveTrack: props.isPreparingActiveTrack,
    libraryFilter: props.activeLibraryFilter,
    libraryMeta: props.libraryMeta,
    libraryTitle: props.libraryTitle,
    modelValue: props.playerQuery,
    spectrumLevels: props.playbackSpectrumLevels,
    tracks: props.visibleTracks,
  }));

  const workspacePageOutletListeners: AppWorkspacePageOutletListeners = {
    'onUpdate:modelValue': (...args) => emit('updatePlayerQuery', ...args),
    onChangePlaylistCover: (...args) => emit('changePlaylistCover', ...args),
    onOpenArtist: (...args) => emit('openArtistFromTrack', ...args),
    onOpenTrackMenu: (...args) => emit('openTrackContextMenu', ...args),
    onPlayFavoriteTracks: () => emit('playFavoriteTracks'),
    onPlayTrack: (...args) => emit('playTrack', ...args),
    onSelectTrack: (...args) => emit('selectTrack', ...args),
    onToggleFavorite: (...args) => emit('toggleFavoriteForTrack', ...args),
  };

  const artistsPageOutletProps = computed<AppArtistsPageOutletProps>(() => ({
    activeArtistName: props.activeArtistName,
    activeTrack: props.activeTrack,
    artistGroups: props.artistGroups,
    favoriteTrackIds: props.favoriteTrackIds,
    isPlaying: props.isAudioPlaying,
    modelValue: props.playerQuery,
    spectrumLevels: props.playbackSpectrumLevels,
  }));

  const artistsPageOutletListeners: AppArtistsPageOutletListeners = {
    'onUpdate:modelValue': (...args) => emit('updatePlayerQuery', ...args),
    onOpenTrackMenu: (...args) => emit('openTrackContextMenu', ...args),
    onPlayTrack: (...args) => emit('playTrack', ...args),
    onSelectArtist: (...args) => emit('selectArtist', ...args),
    onSelectTrack: (...args) => emit('selectTrack', ...args),
    onToggleFavorite: (...args) => emit('toggleFavoriteForTrack', ...args),
  };

  const downloadsPageOutletProps = computed<AppDownloadsPageOutletProps>(() => ({
    activeTrack: props.activeTrack,
    favoriteTrackIds: props.favoriteTrackIds,
    isPlaying: props.isAudioPlaying,
    items: props.downloadItems,
    spectrumLevels: props.playbackSpectrumLevels,
  }));

  const downloadsPageOutletListeners: AppDownloadsPageOutletListeners = {
    onQueueNext: (...args) => emit('queueDownloadedTrackNext', ...args),
    onAddToPlaylist: (...args) => emit('addDownloadedTrackToPlaylist', ...args),
    onDeleteDownload: (...args) => emit('deleteDownloadedItem', ...args),
    onClearRecord: (...args) => emit('clearDownloadedItemRecord', ...args),
    onOpenFolder: (...args) => emit('openDownloadedItemFolder', ...args),
    onPauseDownload: (...args) => emit('pauseDownloadItem', ...args),
    onRetryDownload: (...args) => emit('retryDownloadItem', ...args),
    onResumeDownload: (...args) => emit('resumeDownloadItem', ...args),
    onPlayTrack: (...args) => emit('playDownloadedTrack', ...args),
    onSelectTrack: (...args) => emit('selectTrack', ...args),
    onToggleFavorite: (...args) => emit('toggleFavoriteForTrack', ...args),
  };

  const utilityPageOutletProps = computed<AppUtilityPageOutletProps>(() => ({
    activeView: props.activeView,
  }));

  const utilityPageOutletListeners: AppUtilityPageOutletListeners = {
    onNotify: (...args) => emit('notify', ...args),
  };

  return {
    artistsPageOutletListeners,
    artistsPageOutletProps,
    discoverPageOutletListeners,
    discoverPageOutletProps,
    downloadsPageOutletListeners,
    downloadsPageOutletProps,
    libraryHomePageOutletListeners,
    libraryHomePageOutletProps,
    utilityPageOutletListeners,
    utilityPageOutletProps,
    workspacePageOutletListeners,
    workspacePageOutletProps,
  };
}
