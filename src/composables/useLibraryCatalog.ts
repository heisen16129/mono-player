import { computed } from 'vue';
import { t } from '../i18n';
import type { usePlayerStore } from '../stores/player';
import { normalizePath } from '../utils/path';
import type { LibraryCollection, LibraryFilter } from './useLibraryNavigation';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseLibraryCatalogOptions {
  activeCollection: ReadonlyRefValue<LibraryCollection>;
  activeFolderPath: ReadonlyRefValue<string | null>;
  activeLibraryFilter: ReadonlyRefValue<LibraryFilter>;
  activePlaylistId: ReadonlyRefValue<string | null>;
  player: ReturnType<typeof usePlayerStore>;
}

const folderTones = ['desk', 'night', 'mist', 'road'] as const;

export function useLibraryCatalog({
  activeCollection,
  activeFolderPath,
  activeLibraryFilter,
  activePlaylistId,
  player,
}: UseLibraryCatalogOptions) {
  const allVisibleTracks = computed(() => player.filteredTracks);

  const artistGroups = computed(() => player.libraryStatistics.artists);

  const activeFolder = computed(() => player.libraryStatistics.folders.find(folder => (
    normalizePath(folder.path) === normalizePath(activeFolderPath.value ?? '')
  )));
  const folderVisibleTracks = computed(() => activeFolderPath.value
    ? activeFolder.value?.filteredTracks ?? []
    : allVisibleTracks.value);

  const recentAddedVisibleTracks = computed(() => player.filteredLatestAddedTracks);
  const recentPlayedVisibleTracks = computed(() => player.filteredRecentPlayedTracks);

  const visibleTracks = computed(() => {
    if (activePlaylistId.value) {
      const playlist = player.playlists.find((item) => item.id === activePlaylistId.value);
      return playlist?.tracks ?? [];
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

  const libraryMeta = computed(() => {
    let statistics = player.libraryListStatistics.tracks;
    if (activePlaylistId.value) {
      statistics = player.playlists.find(item => item.id === activePlaylistId.value)?.statistics ?? { count: 0, totalSeconds: 0 };
    } else if (activeCollection.value === 'favorites') {
      statistics = player.favoriteStatistics;
    } else if (activeLibraryFilter.value === 'recentAdded') {
      statistics = player.libraryListStatistics.latestAddedTracks;
    } else if (activeLibraryFilter.value === 'recentPlayed') {
      statistics = player.libraryListStatistics.recentPlayedTracks;
    } else if (activeFolderPath.value) {
      statistics = { count: activeFolder.value?.filteredCount ?? 0, totalSeconds: activeFolder.value?.filteredTotalSeconds ?? 0 };
    }
    return { ...statistics, minutes: Math.round(statistics.totalSeconds / 60) };
  });

  const localFolders = computed(() => player.libraryStatistics.folders.map((folder, index) => ({
    ...folder,
    tone: folderTones[index % folderTones.length],
  })));
  const localFolderTrackCount = computed(() => player.libraryStatistics.folderTrackCount);

  const recentAddedTrackCount = computed(() => player.libraryListTotals.latestAddedTracks.count);

  const libraryTitle = computed(() => {
    if (activePlaylistId.value) {
      return player.playlists.find((playlist) => playlist.id === activePlaylistId.value)?.name ?? t(player.settings.locale, 'localLibrary');
    }
    if (activeLibraryFilter.value === 'recentAdded') return t(player.settings.locale, 'recentAdded');
    if (activeLibraryFilter.value === 'recentPlayed') return t(player.settings.locale, 'recentPlayed');
    if (!activeFolderPath.value) return t(player.settings.locale, 'localLibrary');
    return localFolders.value.find((folder) => folder.path === activeFolderPath.value)?.title ?? t(player.settings.locale, 'localFolder');
  });

  return {
    allVisibleTracks,
    artistGroups,
    folderVisibleTracks,
    libraryMeta,
    libraryTitle,
    localFolderTrackCount,
    localFolders,
    recentAddedTrackCount,
    recentAddedVisibleTracks,
    recentPlayedVisibleTracks,
    visibleTracks,
  };
}
