import { computed } from 'vue';
import { t } from '../i18n';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { folderTitle, normalizePath } from '../utils/path';
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

  const artistGroups = computed(() => {
    const groups = new Map<string, Track[]>();
    const artistNameCollator = new Intl.Collator('zh-Hans-CN', {
      numeric: true,
      sensitivity: 'base',
    });

    for (const track of allVisibleTracks.value) {
      const artist = track.artist?.trim() || t(player.settings.locale, 'unknownArtist');
      const tracks = groups.get(artist) ?? [];
      tracks.push(track);
      groups.set(artist, tracks);
    }

    return [...groups.entries()]
      .map(([name, tracks]) => ({
        name,
        tracks: tracks.sort((left, right) => left.title.localeCompare(right.title, 'zh-Hans-CN')),
      }))
      .sort((left, right) => {
        const countDifference = right.tracks.length - left.tracks.length;
        if (countDifference !== 0) return countDifference;
        return artistNameCollator.compare(left.name, right.name);
      });
  });

  const folderVisibleTracks = computed(() => {
    if (!activeFolderPath.value) return allVisibleTracks.value;

    const normalizedFolder = normalizePath(activeFolderPath.value);
    return allVisibleTracks.value.filter((track) => {
      return normalizePath(track.path).startsWith(`${normalizedFolder}/`);
    });
  });

  const recentAddedVisibleTracks = computed(() => {
    const visibleTrackIds = new Set(allVisibleTracks.value.map((track) => track.id));
    return player.latestAddedTracks.filter((track) => visibleTrackIds.has(track.id));
  });

  const recentPlayedVisibleTracks = computed(() => {
    const trackById = new Map(allVisibleTracks.value.map((track) => [track.id, track]));
    return player.settings.recentPlayedTrackIds
      .map((id) => trackById.get(id))
      .filter((track): track is Track => Boolean(track));
  });

  const visibleTracks = computed(() => {
    if (activePlaylistId.value) {
      const playlist = player.settings.playlists.find((item) => item.id === activePlaylistId.value);
      const localTrackById = new Map(allVisibleTracks.value.map((track) => [track.id, track]));
      const snapshotById = new Map((playlist?.tracks ?? []).map((track) => [track.id, track]));
      return (playlist?.trackIds ?? [])
        .map((id) => localTrackById.get(id) ?? snapshotById.get(id))
        .filter((track): track is Track => Boolean(track));
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
    const totalSeconds = visibleTracks.value.reduce((sum, track) => sum + (track.duration ?? 0), 0);
    return {
      count: visibleTracks.value.length,
      minutes: Math.max(1, Math.round(totalSeconds / 60)),
    };
  });

  const localFolders = computed(() => {
    return player.settings.musicDirs
      .map((path) => {
        const normalizedFolder = normalizePath(path);
        const tracks = player.tracks.filter((track) => {
          const normalizedTrackPath = normalizePath(track.path);
          return normalizedTrackPath.startsWith(`${normalizedFolder}/`);
        });

        return {
          path,
          title: folderTitle(path),
          count: tracks.length,
          tracks,
        };
      })
      .filter((folder) => folder.count > 0)
      .map((folder, index) => ({
        ...folder,
        tone: folderTones[index % folderTones.length],
      }));
  });

  const localFolderTrackCount = computed(() => {
    return localFolders.value.reduce((sum, folder) => sum + folder.count, 0);
  });

  const recentAddedTrackCount = computed(() => recentAddedVisibleTracks.value.length);

  const libraryTitle = computed(() => {
    if (activePlaylistId.value) {
      return player.settings.playlists.find((playlist) => playlist.id === activePlaylistId.value)?.name ?? t(player.settings.locale, 'localLibrary');
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
