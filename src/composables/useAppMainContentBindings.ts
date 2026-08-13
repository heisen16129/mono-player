import { computed } from 'vue';
import type { AppMainContentListeners, AppMainContentProps } from '../types/appMainContent';

type AppMainContentPropSources = {
  [Key in keyof AppMainContentProps]: () => AppMainContentProps[Key];
};

interface UseAppMainContentBindingsOptions {
  listeners: AppMainContentListeners;
  props: AppMainContentPropSources;
}

export function useAppMainContentBindings({ listeners, props }: UseAppMainContentBindingsOptions) {
  const appMainContentProps = computed<AppMainContentProps>(() => ({
    activeArtistName: props.activeArtistName(),
    activeCollection: props.activeCollection(),
    activeFolderPath: props.activeFolderPath(),
    activeLibraryFilter: props.activeLibraryFilter(),
    activePlaylistId: props.activePlaylistId(),
    activeTrack: props.activeTrack(),
    activeView: props.activeView(),
    appGridStyle: props.appGridStyle(),
    artistGroups: props.artistGroups(),
    downloadedTrackKeys: props.downloadedTrackKeys(),
    downloadItems: props.downloadItems(),
    enablePlugins: props.enablePlugins(),
    favoriteTrackIds: props.favoriteTrackIds(),
    isAudioPlaying: props.isAudioPlaying(),
    isLibraryPanelMode: props.isLibraryPanelMode(),
    isLibraryVisible: props.isLibraryVisible(),
    isOnlineSearchOpen: props.isOnlineSearchOpen(),
    isPreparingActiveTrack: props.isPreparingActiveTrack(),
    isResizingLibraryPanel: props.isResizingLibraryPanel(),
    isSidebarCollapsed: props.isSidebarCollapsed(),
    libraryMeta: props.libraryMeta(),
    libraryTitle: props.libraryTitle(),
    localFolderTrackCount: props.localFolderTrackCount(),
    localFolders: props.localFolders(),
    onlineActiveTrackKey: props.onlineActiveTrackKey(),
    onlinePreparingTrackKey: props.onlinePreparingTrackKey(),
    onlineSearchError: props.onlineSearchError(),
    pendingDownloadTrackKeys: props.pendingDownloadTrackKeys(),
    playerError: props.playerError(),
    playerQuery: props.playerQuery(),
    playlists: props.playlists(),
    recentAddedTrackCount: props.recentAddedTrackCount(),
    shouldShowDownloadsMenu: props.shouldShowDownloadsMenu(),
    shouldShowLibraryResizeHandle: props.shouldShowLibraryResizeHandle(),
    visibleTracks: props.visibleTracks(),
  }));

  return {
    appMainContentListeners: listeners,
    appMainContentProps,
  };
}
