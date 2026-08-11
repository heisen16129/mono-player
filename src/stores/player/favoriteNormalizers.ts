import type { Track } from '../../types/music';
import { normalizeTrackLyrics } from '../../utils/trackLyrics';

export function normalizeFavoriteTrackIds(value: unknown): number[] {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  return [...new Set(ids)];
}

export function normalizeTrackSnapshot(value: unknown): Track | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<Track>;
  if (typeof parsed.id !== 'number' || typeof parsed.path !== 'string' || typeof parsed.title !== 'string') {
    return null;
  }

  return {
    id: parsed.id,
    path: parsed.path,
    title: parsed.title,
    artist: Array.isArray(parsed.artist)
      ? parsed.artist.map((name) => typeof name === 'string' ? name.trim() : '').filter(Boolean)
      : null,
    album: typeof parsed.album === 'string' ? parsed.album : null,
    duration: typeof parsed.duration === 'number' ? parsed.duration : null,
    artwork: typeof parsed.artwork === 'string' ? parsed.artwork : null,
    associatedArtwork: typeof parsed.associatedArtwork === 'string' ? parsed.associatedArtwork : null,
    lyrics: parsed.lyrics ? normalizeTrackLyrics({ ...(parsed as Track), associatedLyrics: null }) : null,
    associatedLyrics: parsed.associatedLyrics ? normalizeTrackLyrics({ ...(parsed as Track), lyrics: null }) : null,
    sourceId: typeof parsed.sourceId === 'string' ? parsed.sourceId : null,
    sourceName: typeof parsed.sourceName === 'string' ? parsed.sourceName : null,
    sourceProviderId: typeof parsed.sourceProviderId === 'string' ? parsed.sourceProviderId : null,
    sourceRaw: parsed.sourceRaw,
  };
}

export function normalizeFavoriteTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];
  const tracks = value
    .map((track) => normalizeTrackSnapshot(track))
    .filter((track): track is Track => Boolean(track));
  const trackById = new Map<number, Track>();
  for (const track of tracks) {
    trackById.set(track.id, track);
  }
  return [...trackById.values()];
}

export function normalizeFavoriteStore(value: unknown): { ids: number[]; tracks: Track[] } {
  if (Array.isArray(value)) {
    return { ids: normalizeFavoriteTrackIds(value), tracks: [] };
  }

  if (!value || typeof value !== 'object') {
    return { ids: [], tracks: [] };
  }

  const parsed = value as { ids?: unknown; tracks?: unknown };
  return {
    ids: normalizeFavoriteTrackIds(parsed.ids),
    tracks: normalizeFavoriteTracks(parsed.tracks),
  };
}
