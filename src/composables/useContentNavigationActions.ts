import type { Ref } from 'vue';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseContentNavigationActionsOptions {
  hasMusicSourcePlugin: ReadonlyRefValue<boolean>;
  pluginsEnabled: ReadonlyRefValue<boolean>;
  onlineResolvingTrackKey: Ref<string | null>;
  openDiscoverView: () => void;
  openFolder: (path: string) => void;
  openLibraryView: () => void;
  openRecentAddedInLibrary: () => void;
  openRecentPlayedInLibrary: () => void;
  resetOnlineSearchSnapshot: () => void;
}

export function useContentNavigationActions({
  hasMusicSourcePlugin,
  pluginsEnabled,
  onlineResolvingTrackKey,
  openDiscoverView,
  openFolder,
  openLibraryView,
  openRecentAddedInLibrary,
  openRecentPlayedInLibrary,
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

  function openRecentPlayedFromPanel() {
    clearOnlineNavigationState();
    openRecentPlayedInLibrary();
  }

  function openDiscoverMusicView() {
    if (!pluginsEnabled.value || !hasMusicSourcePlugin.value) return;
    openDiscoverView();
    clearOnlineNavigationState();
  }

  function handleOnlineSearchStarted() {
    if (!pluginsEnabled.value || !hasMusicSourcePlugin.value) return;
    openDiscoverView();
  }

  return {
    handleOnlineSearchStarted,
    openDiscoverMusicView,
    openLocalFolderFromPanel,
    openRecentAddedFromPanel,
    openRecentPlayedFromPanel,
    returnToLocalLibrary,
  };
}
