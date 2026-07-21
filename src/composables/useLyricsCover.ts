import { computed, ref, type ComputedRef } from 'vue';
import { readCover, readCoverThumbnail } from '../services/music';
import { getPlayerOriginalCoverCache, playerCoverCacheKey } from '../services/playerCoverCache';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';

interface LyricsCoverValue {
  data: number[] | null;
  mimeType: string | null;
  url: string;
}

const MAX_LYRICS_COVER_CACHE = 80;
const lyricsCoverCache = new Map<string, LyricsCoverValue>();
const lyricsCoverRequestCache = new Map<string, Promise<LyricsCoverValue | null>>();
const failedArtworkUrls = new Set<string>();
const componentCoverRefs = new Map<string, number>();
let lyricsCoverCacheVersion = 0;

function lyricsCoverCacheKey(path: string, artwork: string | null | undefined, coverVersion: number | undefined) {
  return `${path}:${artwork ?? ''}:${coverVersion ?? ''}:full`;
}

function lyricsCoverThumbCacheKey(path: string, artwork: string | null | undefined, coverVersion: number | undefined) {
  return `${path}:${artwork ?? ''}:${coverVersion ?? ''}:thumb`;
}

function retainLyricsCoverCache(key: string | null) {
  if (!key) return;
  componentCoverRefs.set(key, (componentCoverRefs.get(key) ?? 0) + 1);
}

function releaseLyricsCoverCache(key: string | null) {
  if (!key) return;
  const refs = (componentCoverRefs.get(key) ?? 0) - 1;
  if (refs > 0) {
    componentCoverRefs.set(key, refs);
    return;
  }

  componentCoverRefs.delete(key);
}

function trimLyricsCoverCache() {
  while (lyricsCoverCache.size > MAX_LYRICS_COVER_CACHE) {
    const entry = lyricsCoverCache.entries().next().value;
    if (!entry) return;
    const [key, cached] = entry;
    if (componentCoverRefs.has(key)) return;
    lyricsCoverCache.delete(key);
    revokeTemporaryObjectUrl(cached.url);
  }
}

function setLyricsCoverCache(key: string, value: LyricsCoverValue) {
  lyricsCoverCache.delete(key);
  lyricsCoverCache.set(key, value);
  trimLyricsCoverCache();
}

function deleteLyricsCoverCache(key: string | null) {
  if (!key) return;
  const cached = lyricsCoverCache.get(key);
  lyricsCoverCache.delete(key);
  componentCoverRefs.delete(key);
  revokeTemporaryObjectUrl(cached?.url);
}

export function useLyricsCover(options: {
  activeArtwork: ComputedRef<string | null | undefined>;
  activeTrack: ComputedRef<Track | null>;
  activeTrackIdentityKey: ComputedRef<string>;
}) {
  const coverUrl = ref('');
  const coverData = ref<number[] | null>(null);
  const coverMimeType = ref<string | null>(null);
  const activeCoverCacheKey = ref<string | null>(null);

  const displayCoverUrl = computed(() => {
    if (coverUrl.value) return coverUrl.value;

    const track = options.activeTrack.value;
    const path = track?.path;
    const identityKey = options.activeTrackIdentityKey.value;
    if (!path || !identityKey) return '';

    const artwork = options.activeArtwork.value;
    const coverVersion = track.coverVersion;
    const fullCover = lyricsCoverCache.get(lyricsCoverCacheKey(identityKey, artwork, coverVersion));
    if (fullCover?.url) return fullCover.url;

    return lyricsCoverCache.get(lyricsCoverThumbCacheKey(identityKey, artwork, coverVersion))?.url ?? '';
  });

  const backgroundCoverUrl = computed(() => {
    return displayCoverUrl.value || getPlayerOriginalCoverCache(playerCoverCacheKey(options.activeTrack.value))?.url || '';
  });

  function clearCoverState() {
    releaseLyricsCoverCache(activeCoverCacheKey.value);
    activeCoverCacheKey.value = null;
    coverUrl.value = '';
    coverData.value = null;
    coverMimeType.value = null;
  }

  function setArtworkCover(artwork: string) {
    releaseLyricsCoverCache(activeCoverCacheKey.value);
    activeCoverCacheKey.value = null;
    coverData.value = null;
    coverMimeType.value = null;
    coverUrl.value = artwork;
  }

  function applyCover(key: string, cover: LyricsCoverValue) {
    retainLyricsCoverCache(key);
    releaseLyricsCoverCache(activeCoverCacheKey.value);
    activeCoverCacheKey.value = key;
    coverUrl.value = cover.url;
    coverData.value = cover.data;
    coverMimeType.value = cover.mimeType;
  }

  function prepareTrackCover(identityKey: string, artwork: string | null | undefined, coverVersion: number | undefined) {
    const previousCoverCacheKey = activeCoverCacheKey.value;
    activeCoverCacheKey.value = null;
    const usableArtworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    const playerCoverCache = usableArtworkUrl ? null : getPlayerOriginalCoverCache(playerCoverCacheKey(options.activeTrack.value));
    const nextCoverCacheKey = lyricsCoverCacheKey(identityKey, artwork, coverVersion);
    const nextThumbCacheKey = lyricsCoverThumbCacheKey(identityKey, artwork, coverVersion);
    const cachedCover = playerCoverCache ?? lyricsCoverCache.get(nextCoverCacheKey) ?? lyricsCoverCache.get(nextThumbCacheKey);
    const cachedCoverKey = lyricsCoverCache.has(nextCoverCacheKey) ? nextCoverCacheKey : nextThumbCacheKey;

    if (usableArtworkUrl) {
      releaseLyricsCoverCache(previousCoverCacheKey);
      coverUrl.value = usableArtworkUrl;
      coverData.value = null;
      coverMimeType.value = null;
    } else if (cachedCover) {
      if (!playerCoverCache) retainLyricsCoverCache(cachedCoverKey);
      releaseLyricsCoverCache(previousCoverCacheKey);
      activeCoverCacheKey.value = playerCoverCache ? null : cachedCoverKey;
      coverUrl.value = cachedCover.url;
      coverData.value = cachedCover.data;
      coverMimeType.value = cachedCover.mimeType;
    } else {
      releaseLyricsCoverCache(previousCoverCacheKey);
      coverUrl.value = '';
      coverData.value = null;
      coverMimeType.value = null;
    }

    return {
      nextCoverCacheKey,
      nextThumbCacheKey,
      usableArtworkUrl,
    };
  }

  function hasLyricsCoverCache(key: string) {
    return lyricsCoverCache.has(key);
  }

  function isActiveCoverDisplayed(key: string) {
    return key === activeCoverCacheKey.value && Boolean(coverUrl.value);
  }

  function clearLyricsCoverCache() {
    lyricsCoverCacheVersion += 1;
    for (const cached of lyricsCoverCache.values()) {
      revokeTemporaryObjectUrl(cached.url);
    }
    lyricsCoverCache.clear();
    lyricsCoverRequestCache.clear();
    componentCoverRefs.clear();
    activeCoverCacheKey.value = null;
  }

  async function loadLyricsCover(path: string, artwork: string | null | undefined, coverVersion: number | undefined, cacheSource = path) {
    const key = lyricsCoverCacheKey(cacheSource, artwork, coverVersion);
    const cached = lyricsCoverCache.get(key);
    if (cached) return { key, cover: cached };

    const existingRequest = lyricsCoverRequestCache.get(key);
    if (existingRequest) return { key, cover: await existingRequest };

    const requestCacheVersion = lyricsCoverCacheVersion;
    const request = (async () => {
      const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
      if (artworkUrl) {
        return { url: artworkUrl, data: null, mimeType: null };
      }

      const cover = await readCover(path);
      const url = coverImageObjectUrl(cover);
      if (!cover?.data.length || !url) return null;
      return {
        url,
        data: cover.data,
        mimeType: cover.mime_type,
      };
    })()
      .then((cover) => {
        if (requestCacheVersion !== lyricsCoverCacheVersion) {
          revokeTemporaryObjectUrl(cover?.url);
          return null;
        }
        if (cover) setLyricsCoverCache(key, cover);
        return cover;
      })
      .finally(() => {
        lyricsCoverRequestCache.delete(key);
      });

    lyricsCoverRequestCache.set(key, request);
    return { key, cover: await request };
  }

  async function loadLyricsCoverThumbnail(path: string, artwork: string | null | undefined, coverVersion: number | undefined, cacheSource = path) {
    const key = lyricsCoverThumbCacheKey(cacheSource, artwork, coverVersion);
    const cached = lyricsCoverCache.get(key);
    if (cached) return { key, cover: cached };

    const existingRequest = lyricsCoverRequestCache.get(key);
    if (existingRequest) return { key, cover: await existingRequest };

    const requestCacheVersion = lyricsCoverCacheVersion;
    const request = (async () => {
      const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
      if (artworkUrl) {
        return { url: artworkUrl, data: null, mimeType: null };
      }

      const cover = await readCoverThumbnail(path);
      const url = coverImageObjectUrl(cover);
      if (!cover?.data.length || !url) return null;
      return {
        url,
        data: null,
        mimeType: cover.mime_type,
      };
    })()
      .then((cover) => {
        if (requestCacheVersion !== lyricsCoverCacheVersion) {
          revokeTemporaryObjectUrl(cover?.url);
          return null;
        }
        if (cover) setLyricsCoverCache(key, cover);
        return cover;
      })
      .finally(() => {
        lyricsCoverRequestCache.delete(key);
      });

    lyricsCoverRequestCache.set(key, request);
    return { key, cover: await request };
  }

  function handleCoverError() {
    if (coverUrl.value && !isTemporaryObjectUrl(coverUrl.value)) {
      failedArtworkUrls.add(coverUrl.value);
    }
    const key = activeCoverCacheKey.value;
    deleteLyricsCoverCache(key);
    activeCoverCacheKey.value = null;
    coverUrl.value = '';
    const track = options.activeTrack.value;
    if (!track?.path) return;
    void (async () => {
      const identityKey = options.activeTrackIdentityKey.value || track.path;
      const { key, cover } = await loadLyricsCoverThumbnail(
        track.path,
        options.activeArtwork.value,
        track.coverVersion,
        identityKey,
      );
      if (!cover || options.activeTrack.value?.path !== track.path) return;
      applyCover(key, cover);
    })();
  }

  return {
    applyCover,
    backgroundCoverUrl,
    clearCoverState,
    clearLyricsCoverCache,
    coverData,
    coverMimeType,
    coverUrl,
    displayCoverUrl,
    handleCoverError,
    hasLyricsCoverCache,
    isActiveCoverDisplayed,
    loadLyricsCover,
    loadLyricsCoverThumbnail,
    prepareTrackCover,
    setArtworkCover,
  };
}
