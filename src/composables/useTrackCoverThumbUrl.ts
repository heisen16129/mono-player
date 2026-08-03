import { onBeforeUnmount, onMounted, ref, type ComponentPublicInstance, type MaybeRefOrGetter, toValue, watch } from 'vue';
import { readCoverThumbnail } from '../services/music';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';

const MAX_CACHED_COVERS = 360;
const coverUrlCache = new Map<string, string | null>();
const coverRequestCache = new Map<string, Promise<string | null>>();
const failedArtworkUrls = new Set<string>();
const MAX_CONCURRENT_COVER_READS = 5;
let activeCoverReads = 0;
const pendingCoverReads: Array<() => void> = [];

export function useTrackCoverThumbUrl(track: MaybeRefOrGetter<Track>) {
  const coverUrl = ref('');
  const coverRoot = ref<HTMLElement | null>(null);
  const isVisible = ref(false);
  let loadId = 0;
  let observer: IntersectionObserver | null = null;

  async function loadCurrentCover() {
    const currentTrack = toValue(track);
    await loadCover(currentTrack.id, currentTrack.path, currentTrack.artwork, currentTrack.coverVersion);
  }

  async function loadCover(id: number, path: string, artwork: string | null | undefined, coverVersion: number | undefined) {
    const currentLoadId = ++loadId;
    coverUrl.value = '';

    const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    if (artworkUrl) {
      coverUrl.value = artworkUrl;
      return;
    }

    if (!path || !isVisible.value) return;

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

  function setCoverRoot(element: Element | ComponentPublicInstance | null) {
    const nextElement = element instanceof HTMLElement ? element : null;
    if (coverRoot.value && coverRoot.value !== nextElement) {
      observer?.unobserve(coverRoot.value);
    }
    coverRoot.value = nextElement;
    if (coverRoot.value && observer) {
      observer.observe(coverRoot.value);
    }
  }

  watch(
    () => {
      const currentTrack = toValue(track);
      return [currentTrack.id, currentTrack.path, currentTrack.artwork, currentTrack.coverVersion] as const;
    },
    ([id, path, artwork, coverVersion]) => {
      void loadCover(id, path, artwork, coverVersion);
    },
    { immediate: true },
  );

  watch(isVisible, (visible) => {
    if (!visible || coverUrl.value) return;
    void loadCurrentCover();
  });

  onMounted(() => {
    if (!('IntersectionObserver' in window)) {
      isVisible.value = true;
      return;
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.value = Boolean(entry?.isIntersecting);
      },
      { rootMargin: '160px 0px' },
    );
    if (coverRoot.value) {
      observer.observe(coverRoot.value);
    }
  });

  onBeforeUnmount(() => {
    loadId += 1;
    observer?.disconnect();
    observer = null;
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

  const existingRequest = coverRequestCache.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = runLimitedCoverRead(() => readCoverThumbnail(path))
    .then((cover) => {
      if (!cover?.data.length) {
        touchCachedCover(cacheKey, null);
        return null;
      }

      const objectUrl = coverImageObjectUrl(cover);
      if (!objectUrl) {
        touchCachedCover(cacheKey, null);
        return null;
      }
      touchCachedCover(cacheKey, objectUrl);
      return objectUrl;
    })
    .catch(() => {
      touchCachedCover(cacheKey, null);
      return null;
    })
    .finally(() => {
      coverRequestCache.delete(cacheKey);
    });

  coverRequestCache.set(cacheKey, request);
  return request;
}
