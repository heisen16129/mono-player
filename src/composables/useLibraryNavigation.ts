import { ref } from 'vue';

export type AppView = 'library' | 'discover' | 'artists' | 'settings' | 'themes' | 'plugins' | 'downloads' | 'plugin-page';
export type LibraryCollection = 'all' | 'favorites';
export type LibraryFilter = 'all' | 'recentAdded' | 'recentPlayed';

export function useLibraryNavigation(getDefaultArtistName: () => string | null) {
  const activeView = ref<AppView>('library');
  const isSettingsOpen = ref(false);
  const activeCollection = ref<LibraryCollection>('all');
  const activeLibraryFilter = ref<LibraryFilter>('all');
  const isLibraryPanelMode = ref(true);
  const activeFolderPath = ref<string | null>(null);
  const activePlaylistId = ref<string | null>(null);
  const activeArtistName = ref<string | null>(null);
  let libraryReturnState: { view: 'library' | 'downloads'; filter: LibraryFilter; folder: string | null } | null = null;

  function rememberLibraryLocation() {
    if (activeView.value === 'downloads' || (activeView.value === 'library' && isLibraryPanelMode.value)) {
      libraryReturnState = {
        view: activeView.value,
        filter: activeLibraryFilter.value,
        folder: activeFolderPath.value,
      };
    }
  }

  function openLibraryView() {
    const previous = activeView.value === 'artists' ? libraryReturnState : null;
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = true;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
    if (previous) {
      activeView.value = previous.view;
      activeLibraryFilter.value = previous.filter;
      activeFolderPath.value = previous.folder;
    }
  }

  function openDiscoverView() {
    activeView.value = 'discover';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openFavoritesView() {
    activeView.value = 'library';
    activeCollection.value = 'favorites';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openFolder(path: string) {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = true;
    activeFolderPath.value = path;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openRecentAddedInLibrary() {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'recentAdded';
    isLibraryPanelMode.value = true;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openRecentPlayedInLibrary() {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'recentPlayed';
    isLibraryPanelMode.value = true;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openRecentAdded() {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'recentAdded';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openRecentPlayed() {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'recentPlayed';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openArtistsView() {
    rememberLibraryLocation();
    activeView.value = 'artists';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = getDefaultArtistName();
  }

  function openSettingsView() {
    isSettingsOpen.value = true;
  }

  function openThemeView() {
    activeView.value = 'themes';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openPluginsView() {
    activeView.value = 'plugins';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openDownloadsView() {
    activeView.value = 'downloads';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
  }

  function openPlaylistView(playlistId: string) {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = playlistId;
    activeArtistName.value = null;
  }

  function openArtistFromTrack(name: string) {
    rememberLibraryLocation();
    activeView.value = 'artists';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = name;
  }

  function selectArtist(name: string) {
    activeArtistName.value = name;
  }

  return {
    activeArtistName,
    activeCollection,
    activeFolderPath,
    activeLibraryFilter,
    activePlaylistId,
    activeView,
    isLibraryPanelMode,
    isSettingsOpen,
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
    openRecentPlayedInLibrary,
    openRecentPlayed,
    openSettingsView,
    openThemeView,
    selectArtist,
  };
}
