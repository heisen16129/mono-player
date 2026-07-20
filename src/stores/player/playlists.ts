import type { Track, UserPlaylist } from '../../types/music';
import { createTrackSnapshot } from './favorites';

export function createPlaylistEntry(playlists: UserPlaylist[], name: string, initialTracks: Array<number | Track>, libraryTracks: Track[], createdAt: number) {
  const title = name.trim();
  if (!title || playlists.some((playlist) => playlist.name.trim() === title)) {
    return { created: false, playlists };
  }

  const trackIds = initialTracks.map((track) => (typeof track === 'number' ? track : track.id));
  const snapshots = initialTracks
    .filter((track): track is Track => typeof track !== 'number' && !libraryTracks.some((item) => item.id === track.id))
    .map((track) => createTrackSnapshot(track));

  return {
    created: true,
    playlists: [
      ...playlists,
      {
        id: `playlist-${createdAt}`,
        name: title,
        trackIds,
        tracks: snapshots,
        createdAt,
      },
    ],
  };
}

export function renamePlaylistEntry(playlists: UserPlaylist[], playlistId: string, name: string) {
  const title = name.trim();
  if (!title || playlists.some((playlist) => playlist.id !== playlistId && playlist.name.trim() === title)) {
    return { renamed: false, playlists };
  }

  let renamed = false;
  const nextPlaylists = playlists.map((playlist) => {
    if (playlist.id !== playlistId) return playlist;
    renamed = true;
    return { ...playlist, name: title };
  });

  return { renamed, playlists: nextPlaylists };
}

export function deletePlaylistEntry(playlists: UserPlaylist[], playlistId: string) {
  const nextPlaylists = playlists.filter((playlist) => playlist.id !== playlistId);
  return {
    deleted: nextPlaylists.length !== playlists.length,
    playlists: nextPlaylists,
  };
}

export function addTrackToPlaylistEntry(playlists: UserPlaylist[], playlistId: string, track: Track, libraryTracks: Track[]) {
  let added = false;

  const nextPlaylists = playlists.map((playlist) => {
    if (playlist.id !== playlistId || playlist.trackIds.includes(track.id)) {
      return playlist;
    }

    added = true;
    const snapshots = playlist.tracks ?? [];
    const shouldStoreSnapshot = !libraryTracks.some((item) => item.id === track.id);
    return {
      ...playlist,
      trackIds: [track.id, ...playlist.trackIds.filter((id) => id !== track.id)],
      tracks: shouldStoreSnapshot
        ? [createTrackSnapshot(track), ...snapshots.filter((item) => item.id !== track.id)]
        : snapshots,
    };
  });

  return { added, playlists: nextPlaylists };
}

export function removeTrackFromPlaylistEntry(playlists: UserPlaylist[], playlistId: string, track: Track) {
  let removed = false;

  const nextPlaylists = playlists.map((playlist) => {
    if (playlist.id !== playlistId || !playlist.trackIds.includes(track.id)) {
      return playlist;
    }

    removed = true;
    return {
      ...playlist,
      trackIds: playlist.trackIds.filter((id) => id !== track.id),
      tracks: (playlist.tracks ?? []).filter((item) => item.id !== track.id),
    };
  });

  return { removed, playlists: nextPlaylists };
}
