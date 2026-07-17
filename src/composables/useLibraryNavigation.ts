import { ref, type ComputedRef } from 'vue';

export type AppView = 'library' | 'discover' | 'artists' | 'settings' | 'themes' | 'plugins' | 'downloads';
export type LibraryCollection = 'all' | 'favorites';
export type LibraryFilter = 'all' | 'recentAdded' | 'recentPlayed';

export interface ArtistGroupLike {
  name: string;
}

export function useLibraryNavigation(artistGroups: ComputedRef<ArtistGroupLike[]>) {
  const activeView = ref<AppView>('library');
  const activeCollection = ref<LibraryCollection>('all');
  const activeLibraryFilter = ref<LibraryFilter>('all');
  const isLibraryPanelMode = ref(true);
  const activeFolderPath = ref<string | null>(null);
  const activePlaylistId = ref<string | null>(null);
  const activeArtistName = ref<string | null>(null);

  function openLibraryView() {
    activeView.value = 'library';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = true;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
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
    activeView.value = 'artists';
    activeCollection.value = 'all';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = artistGroups.value[0]?.name ?? null;
  }

  function openSettingsView() {
    activeView.value = 'settings';
    activeLibraryFilter.value = 'all';
    isLibraryPanelMode.value = false;
    activeFolderPath.value = null;
    activePlaylistId.value = null;
    activeArtistName.value = null;
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
  };
}
