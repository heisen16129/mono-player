import { onBeforeUnmount, ref, type MaybeRefOrGetter, toValue, watch } from 'vue';
import { readCoverThumbnail } from '../services/music';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, trackArtworkSource, usableArtworkDisplaySrc } from '../utils/artwork';

const MAX_CACHED_COVERS = 360;
const coverUrlCache = new Map<string, string | null>();
const coverRequestCache = new Map<string, Promise<string | null>>();
const failedArtworkUrls = new Set<string>();
const failedLocalCoverKeys = new Set<string>();
const MAX_CONCURRENT_COVER_READS = 5;
let activeCoverReads = 0;
const pendingCoverReads: Array<() => void> = [];

export function useTrackCoverThumbUrl(track: MaybeRefOrGetter<Track>) {
  const coverUrl = ref('');
  let loadId = 0;

  async function loadCurrentCover() {
    const currentTrack = toValue(track);
    await loadCover(currentTrack.id, currentTrack.path, trackArtworkSource(currentTrack), currentTrack.coverVersion);
  }

  async function loadCover(id: number, path: string, artwork: string | null | undefined, coverVersion: number | undefined) {
    const currentLoadId = ++loadId;
    coverUrl.value = '';

    const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    if (artworkUrl) {
      coverUrl.value = artworkUrl;
      return;
    }

    if (!path) return;

    const cachedUrl = await getCachedCoverUrl(path, `${id}:${path}:${artwork ?? ''}:${coverVersion ?? ''}`);
    if (currentLoadId !== loadId || !cachedUrl) return;
    coverUrl.value = cachedUrl;
  }

  function handleImageError() {
    const failedUrl = coverUrl.value;
    if (!failedUrl) return;

    if (isTemporaryObjectUrl(failedUrl)) {
      const failedEntry = Array.from(coverUrlCache.entries()).find(([, cachedUrl]) => cachedUrl === failedUrl);
      if (failedEntry) {
        revokeTemporaryObjectUrl(failedUrl);
        touchCachedCover(failedEntry[0], null);
      }
    } else {
      failedArtworkUrls.add(failedUrl);
    }

    coverUrl.value = '';
    void loadCurrentCover();
  }

  function setCoverRoot() {
    return undefined;
  }

  watch(
    () => {
      const currentTrack = toValue(track);
      return [currentTrack.id, currentTrack.path, trackArtworkSource(currentTrack), currentTrack.coverVersion] as const;
    },
    ([id, path, artwork, coverVersion]) => {
      void loadCover(id, path, artwork, coverVersion);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    loadId += 1;
  });

  return {
    coverUrl,
    handleImageError,
    setCoverRoot,
  };
}

function touchCachedCover(key: string, value: string | null) {
  coverUrlCache.delete(key);
  coverUrlCache.set(key, value);

  while (coverUrlCache.size > MAX_CACHED_COVERS) {
    const [oldestKey, oldestUrl] = coverUrlCache.entries().next().value ?? [];
    if (!oldestKey) return;
    coverUrlCache.delete(oldestKey);
    revokeTemporaryObjectUrl(oldestUrl);
  }
}

async function runLimitedCoverRead<T>(task: () => Promise<T>): Promise<T> {
  if (activeCoverReads >= MAX_CONCURRENT_COVER_READS) {
    await new Promise<void>((resolve) => pendingCoverReads.push(resolve));
  }

  activeCoverReads += 1;
  try {
    return await task();
  } finally {
    activeCoverReads = Math.max(0, activeCoverReads - 1);
    pendingCoverReads.shift()?.();
  }
}

async function getCachedCoverUrl(path: string, cacheKey: string) {
  if (coverUrlCache.has(cacheKey)) {
    const cachedUrl = coverUrlCache.get(cacheKey) ?? null;
    touchCachedCover(cacheKey, cachedUrl);
    return cachedUrl;
  }
  if (failedLocalCoverKeys.has(cacheKey)) return null;

  const existingRequest = coverRequestCache.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = runLimitedCoverRead(() => readCoverThumbnail(path))
    .then((cover) => {
      if (!cover?.data.length) {
        failedLocalCoverKeys.add(cacheKey);
        touchCachedCover(cacheKey, null);
        return null;
      }

      const objectUrl = coverImageObjectUrl(cover);
      if (!objectUrl) {
        failedLocalCoverKeys.add(cacheKey);
        touchCachedCover(cacheKey, null);
        return null;
      }
      touchCachedCover(cacheKey, objectUrl);
      return objectUrl;
    })
    .catch(() => {
      failedLocalCoverKeys.add(cacheKey);
      touchCachedCover(cacheKey, null);
      return null;
    })
    .finally(() => {
      coverRequestCache.delete(cacheKey);
    });

  coverRequestCache.set(cacheKey, request);
  return request;
}
