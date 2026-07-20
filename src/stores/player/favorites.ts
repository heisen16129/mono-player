import type { Track } from '../../types/music';

export function createTrackSnapshot(track: Track): Track {
  return {
    id: track.id,
    path: track.path,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    artwork: track.artwork ?? null,
    associatedArtwork: track.associatedArtwork ?? null,
    lyrics: track.lyrics ?? null,
    associatedLyrics: track.associatedLyrics ?? null,
    sourceId: track.sourceId ?? null,
    sourceName: track.sourceName ?? null,
    sourceProviderId: track.sourceProviderId ?? null,
    sourceRaw: track.sourceRaw,
  };
}

export function resolveFavoriteTracks(favoriteIds: number[], libraryTracks: Track[], snapshots: Track[]) {
  const localTrackById = new Map(libraryTracks.map((track) => [track.id, track]));
  const snapshotById = new Map(snapshots.map((track) => [track.id, track]));
  return favoriteIds
    .map((id) => localTrackById.get(id) ?? snapshotById.get(id))
    .filter((track): track is Track => Boolean(track));
}

export function toggleFavoriteTrack(track: Track, favoriteIds: number[], snapshots: Track[], libraryTracks: Track[]) {
  if (favoriteIds.includes(track.id)) {
    return {
      isFavorite: false,
      favoriteIds: favoriteIds.filter((id) => id !== track.id),
      snapshots: snapshots.filter((item) => item.id !== track.id),
    };
  }

  const shouldStoreSnapshot = !libraryTracks.some((item) => item.id === track.id);
  return {
    isFavorite: true,
    favoriteIds: [track.id, ...favoriteIds.filter((id) => id !== track.id)],
    snapshots: shouldStoreSnapshot
      ? [createTrackSnapshot(track), ...snapshots.filter((item) => item.id !== track.id)]
      : snapshots,
  };
}
