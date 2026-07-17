import type { CoverImage, Track } from '../types/music';

export interface PlayerOriginalCoverCache {
  key: string;
  url: string;
  data: number[] | null;
  mimeType: string | null;
}

let cachedCover: PlayerOriginalCoverCache | null = null;

export function playerCoverCacheKey(track: Pick<Track, 'id' | 'path' | 'artwork' | 'coverVersion'> | null | undefined) {
  if (!track?.path) return '';
  return `${track.id ?? ''}:${track.path}:${track.artwork ?? ''}:${track.coverVersion ?? ''}`;
}

export function getPlayerOriginalCoverCache(key: string) {
  if (!key || cachedCover?.key !== key) return null;
  return cachedCover;
}

export function setPlayerOriginalCoverCache(key: string, cover: CoverImage) {
  clearPlayerOriginalCoverCache();
  if (!key || !cover.data.length) return null;

  cachedCover = {
    key,
    url: URL.createObjectURL(new Blob([new Uint8Array(cover.data)], { type: cover.mime_type })),
    data: cover.data,
    mimeType: cover.mime_type,
  };
  return cachedCover;
}

export function setPlayerArtworkCoverCache(key: string, artwork: string) {
  clearPlayerOriginalCoverCache();
  if (!key || !artwork.trim()) return null;

  cachedCover = {
    key,
    url: artwork.trim(),
    data: null,
    mimeType: null,
  };
  return cachedCover;
}

export function clearPlayerOriginalCoverCache() {
  if (cachedCover?.url.startsWith('blob:')) {
    URL.revokeObjectURL(cachedCover.url);
  }
  cachedCover = null;
}
