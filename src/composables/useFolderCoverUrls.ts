import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { readCoverThumbnail } from '../services/music';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';

const MAX_FOLDER_COVER_CACHE = 80;
const MAX_TRACK_COVER_CACHE = 240;
const folderCoverCache = new Map<string, { urls: (string | null)[]; refs: number }>();
const folderCoverRequestCache = new Map<string, Promise<(string | null)[]>>();
const trackCoverUrlCache = new Map<string, string | null>();
const trackCoverRequestCache = new Map<string, Promise<string | null>>();
const failedArtworkUrls = new Set<string>();

function releaseCacheKey(key: string) {
  if (!key) return;
  const cached = folderCoverCache.get(key);
  if (!cached) return;
  cached.refs = Math.max(0, cached.refs - 1);
}

function trimFolderCoverCache() {
  for (const [key, cached] of folderCoverCache) {
    if (folderCoverCache.size <= MAX_FOLDER_COVER_CACHE) break;
    if (cached.refs > 0) continue;
    for (const url of cached.urls) {
      revokeTemporaryObjectUrl(url);
    }
    folderCoverCache.delete(key);
  }
}

function trackCacheKey(track: Track) {
  return `${track.id}:${track.path}:${track.artwork ?? ''}:${track.coverVersion ?? ''}`;
}

function trimTrackCoverCache() {
  while (trackCoverUrlCache.size > MAX_TRACK_COVER_CACHE) {
    const [key, url] = trackCoverUrlCache.entries().next().value ?? [];
    if (typeof key !== 'string') break;
    revokeTemporaryObjectUrl(url);
    trackCoverUrlCache.delete(key);
  }
}

function coverCandidates(tracks: Track[]) {
  return tracks.length >= 4 ? tracks.slice(0, 4) : tracks.filter((track) => track.path).slice(0, 4);
}

function cacheKeyForTracks(tracks: Track[]) {
  const mode = tracks.length >= 4 ? 'grid' : 'single';
  return `${mode}:${coverCandidates(tracks).map((track) => trackCacheKey(track)).join('|')}`;
}

async function coverUrlForTrack(track: Track) {
  const artworkUrl = usableArtworkDisplaySrc(track.artwork, failedArtworkUrls);
  if (artworkUrl) return artworkUrl;
  if (!track.path) return null;

  const cacheKey = trackCacheKey(track);
  if (trackCoverUrlCache.has(cacheKey)) {
    return trackCoverUrlCache.get(cacheKey) ?? null;
  }

  const existingRequest = trackCoverRequestCache.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = readCoverThumbnail(track.path)
    .then((cover) => {
      return coverImageObjectUrl(cover);
    })
    .then((url) => {
      trackCoverUrlCache.set(cacheKey, url);
      trimTrackCoverCache();
      return url;
    })
    .finally(() => {
      trackCoverRequestCache.delete(cacheKey);
    });

  trackCoverRequestCache.set(cacheKey, request);
  return request;
}

async function loadCoverUrlsForTracks(tracks: Track[]) {
  const grid = tracks.length >= 4;
  const urls: (string | null)[] = [];

  for (const track of coverCandidates(tracks)) {
    try {
      const url = await coverUrlForTrack(track);
      urls.push(url);
      if (!grid && url) break;
    } catch {
      // Keep the existing fallback art when a single file has no readable cover.
      urls.push(null);
    }
  }

  return urls;
}

function disposeFolderCoverCaches() {
  for (const cached of folderCoverCache.values()) {
    for (const url of cached.urls) {
      revokeTemporaryObjectUrl(url);
    }
  }
  folderCoverCache.clear();
  folderCoverRequestCache.clear();
  for (const url of trackCoverUrlCache.values()) {
    revokeTemporaryObjectUrl(url);
  }
  trackCoverUrlCache.clear();
  trackCoverRequestCache.clear();
}

export function useFolderCoverUrls(tracks: Ref<Track[]>) {
  const coverUrls = ref<(string | null)[]>([]);
  let loadId = 0;
  let activeCacheKey = '';

  const shouldUseGrid = computed(() => tracks.value.length >= 4);
  const visibleCovers = computed(() => {
    if (!shouldUseGrid.value) {
      return coverUrls.value.filter((url): url is string => Boolean(url)).slice(0, 1);
    }

    return coverUrls.value.slice(0, 4);
  });

  function trackForVisibleCover(index: number) {
    return coverCandidates(tracks.value)[index] ?? null;
  }

  async function handleCoverError(index: number) {
    const failedUrl = visibleCovers.value[index];
    const track = trackForVisibleCover(index);
    if (failedUrl && !isTemporaryObjectUrl(failedUrl)) failedArtworkUrls.add(failedUrl);
    if (!track?.path) {
      coverUrls.value[index] = null;
      return;
    }

    const fallbackUrl = await coverUrlForTrack(track);
    coverUrls.value[index] = fallbackUrl;
  }

  watch(
    () => cacheKeyForTracks(tracks.value),
    async (cacheKey) => {
      const currentLoadId = ++loadId;
      const previousCacheKey = activeCacheKey;
      activeCacheKey = cacheKey;
      releaseCacheKey(previousCacheKey);

      const cached = folderCoverCache.get(cacheKey);
      if (cached) {
        cached.refs += 1;
        coverUrls.value = cached.urls;
        trimFolderCoverCache();
        return;
      }

      const request = folderCoverRequestCache.get(cacheKey) ?? loadCoverUrlsForTracks(tracks.value);
      folderCoverRequestCache.set(cacheKey, request);
      const urls = await request.finally(() => {
        folderCoverRequestCache.delete(cacheKey);
      });

      if (currentLoadId !== loadId) {
        if (!folderCoverCache.has(cacheKey)) {
          for (const url of urls) {
            revokeTemporaryObjectUrl(url);
          }
        }
        return;
      }

      folderCoverCache.set(cacheKey, { urls, refs: 1 });
      coverUrls.value = urls;
      trimFolderCoverCache();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    loadId += 1;
    releaseCacheKey(activeCacheKey);
    activeCacheKey = '';
    coverUrls.value = [];
    trimFolderCoverCache();
  });

  return {
    handleCoverError,
    shouldUseGrid,
    visibleCovers,
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(disposeFolderCoverCaches);
}
