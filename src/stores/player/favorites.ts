import type { Track } from '../../types/music';
import { normalizePath } from '../../utils/path';

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
    .map((id) => {
      const snapshot = snapshotById.get(id);
      return localTrackById.get(id) ?? findMatchingLibraryTrack(snapshot, libraryTracks) ?? snapshot;
    })
    .filter((track): track is Track => Boolean(track));
}

export function toggleFavoriteTrack(track: Track, favoriteIds: number[], snapshots: Track[], libraryTracks: Track[]) {
  const existingFavoriteId = findMatchingFavoriteId(track, favoriteIds, snapshots, libraryTracks);

  if (existingFavoriteId !== null) {
    return {
      isFavorite: false,
      favoriteIds: favoriteIds.filter((id) => id !== existingFavoriteId),
      snapshots: snapshots.filter((item) => item.id !== existingFavoriteId),
    };
  }

  const favoriteTrack = findMatchingLibraryTrack(track, libraryTracks) ?? track;
  const favoriteId = favoriteTrack.id;
  const shouldStoreSnapshot = !libraryTracks.some((item) => item.id === favoriteId);
  return {
    isFavorite: true,
    favoriteIds: [favoriteId, ...favoriteIds.filter((id) => id !== favoriteId)],
    snapshots: shouldStoreSnapshot
      ? [createTrackSnapshot(favoriteTrack), ...snapshots.filter((item) => item.id !== favoriteId)]
      : snapshots,
  };
}

export function isFavoriteTrack(track: Track | null, favoriteIds: number[], snapshots: Track[], libraryTracks: Track[]) {
  if (!track) return false;
  return findMatchingFavoriteId(track, favoriteIds, snapshots, libraryTracks) !== null;
}

function findMatchingFavoriteId(track: Track, favoriteIds: number[], snapshots: Track[], libraryTracks: Track[]) {
  const localTrackById = new Map(libraryTracks.map((item) => [item.id, item]));
  const snapshotById = new Map(snapshots.map((item) => [item.id, item]));

  for (const id of favoriteIds) {
    const snapshot = snapshotById.get(id);
    const favoriteTrack = localTrackById.get(id) ?? findMatchingLibraryTrack(snapshot, libraryTracks) ?? snapshot;
    if (hasSameTrackIdentity(track, favoriteTrack)) return id;
  }

  return null;
}

function findMatchingLibraryTrack(track: Track | null | undefined, candidates: Track[]) {
  if (!track) return null;

  const path = normalizePath(track.path);
  if (path) {
    const pathMatch = candidates.find((item) => normalizePath(item.path) === path);
    if (pathMatch) return pathMatch;
  }

  if (track.sourceId) {
    const sourceMatch = candidates.find((item) => (
      item.sourceId === track.sourceId
      && (!track.sourceName || item.sourceName === track.sourceName)
    ));
    if (sourceMatch) return sourceMatch;
  }

  return candidates.find((item) => item.id === track.id) ?? null;
}

function hasSameTrackIdentity(track: Track | null | undefined, other: Track | null | undefined) {
  if (!track || !other) return false;

  const path = normalizePath(track.path);
  const otherPath = normalizePath(other.path);
  if (path && otherPath && path === otherPath) return true;

  if (track.sourceId && other.sourceId && track.sourceId === other.sourceId) {
    if (!track.sourceName || !other.sourceName || track.sourceName === other.sourceName) return true;
  }

  return track.id === other.id;
}
