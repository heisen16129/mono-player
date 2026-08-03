import type { Ref } from 'vue';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseContentNavigationActionsOptions {
  pluginsEnabled: ReadonlyRefValue<boolean>;
  onlineResolvingTrackKey: Ref<string | null>;
  openDiscoverView: () => void;
  openFolder: (path: string) => void;
  openLibraryView: () => void;
  openRecentAddedInLibrary: () => void;
  resetOnlineSearchSnapshot: () => void;
}

export function useContentNavigationActions({
  pluginsEnabled,
  onlineResolvingTrackKey,
  openDiscoverView,
  openFolder,
  openLibraryView,
  openRecentAddedInLibrary,
  resetOnlineSearchSnapshot,
}: UseContentNavigationActionsOptions) {
  function clearOnlineNavigationState() {
    resetOnlineSearchSnapshot();
    onlineResolvingTrackKey.value = null;
  }

  function returnToLocalLibrary() {
    clearOnlineNavigationState();
    openLibraryView();
  }

  function openLocalFolderFromPanel(path: string) {
    clearOnlineNavigationState();
    openFolder(path);
  }

  function openRecentAddedFromPanel() {
    clearOnlineNavigationState();
    openRecentAddedInLibrary();
  }

  function openDiscoverMusicView() {
    if (!pluginsEnabled.value) return;
    openDiscoverView();
    clearOnlineNavigationState();
  }

  function handleOnlineSearchStarted() {
    openDiscoverView();
  }

  return {
    handleOnlineSearchStarted,
    openDiscoverMusicView,
    openLocalFolderFromPanel,
    openRecentAddedFromPanel,
    returnToLocalLibrary,
  };
}
