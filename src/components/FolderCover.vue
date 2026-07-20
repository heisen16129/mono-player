<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { readCoverThumbnail } from '../services/music';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';
import DefaultCover from './DefaultCover.vue';

const props = defineProps<{
  tracks: Track[];
  tone?: 'desk' | 'night' | 'mist' | 'road';
}>();

const coverUrls = ref<(string | null)[]>([]);
let loadId = 0;

const folderCoverCache = new Map<string, { urls: (string | null)[]; refs: number }>();
const folderCoverRequestCache = new Map<string, Promise<(string | null)[]>>();
const trackCoverUrlCache = new Map<string, string | null>();
const trackCoverRequestCache = new Map<string, Promise<string | null>>();
const failedArtworkUrls = new Set<string>();
const MAX_FOLDER_COVER_CACHE = 80;
const MAX_TRACK_COVER_CACHE = 240;
let activeCacheKey = '';

const shouldUseGrid = computed(() => props.tracks.length >= 4);
const visibleCovers = computed(() => {
  if (!shouldUseGrid.value) {
    return coverUrls.value.filter((url): url is string => Boolean(url)).slice(0, 1);
  }

  return coverUrls.value.slice(0, 4);
});

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

function cacheKeyForTracks(tracks: Track[]) {
  const mode = tracks.length >= 4 ? 'grid' : 'single';
  const candidates = tracks.length >= 4 ? tracks.slice(0, 4) : tracks.filter((track) => track.path).slice(0, 4);
  return `${mode}:${candidates.map((track) => `${track.id}:${track.path}:${track.artwork ?? ''}:${track.coverVersion ?? ''}`).join('|')}`;
}

async function loadCoverUrlsForTracks(tracks: Track[]) {
  const grid = tracks.length >= 4;
  const candidates = grid ? tracks.slice(0, 4) : tracks.filter((track) => track.path).slice(0, 4);
  const urls: (string | null)[] = [];

  for (const track of candidates) {
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

function trackForVisibleCover(index: number) {
  const grid = props.tracks.length >= 4;
  const candidates = grid ? props.tracks.slice(0, 4) : props.tracks.filter((track) => track.path).slice(0, 4);
  return candidates[index] ?? null;
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
  () => cacheKeyForTracks(props.tracks),
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

    const request = folderCoverRequestCache.get(cacheKey) ?? loadCoverUrlsForTracks(props.tracks);
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
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
  });
}
</script>

<template>
  <span
    class="folder-cover"
    :class="[
      tone || 'night',
      {
        'is-grid': shouldUseGrid,
        'has-cover-image': visibleCovers.some(Boolean),
      },
    ]"
    aria-hidden="true"
  >
    <template v-if="shouldUseGrid">
      <span v-for="index in 4" :key="index" class="folder-cover-cell">
        <img v-if="visibleCovers[index - 1]" :src="visibleCovers[index - 1] ?? undefined" alt="" @error="handleCoverError(index - 1)" />
      </span>
    </template>
    <img v-else-if="visibleCovers[0]" :src="visibleCovers[0]" alt="" @error="handleCoverError(0)" />
    <template v-else>
      <DefaultCover class="folder-cover-placeholder-icon" :size="80" :stroke-width="2.1" />
    </template>
  </span>
</template>

<style scoped>

.cover-mini {
  display: block;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background:
    radial-gradient(circle at 35% 35%, var(--smw-cover-dot) 0 1px, transparent 2px),
    radial-gradient(circle at 62% 58%, var(--smw-cover-dot-soft) 0 1px, transparent 2px),
    linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.cover-image {
  object-fit: cover;
}

.cover-button {
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition:
    transform 160ms ease,
    outline-color 160ms ease;
}

.cover-button:hover {
  outline: 2px solid rgba(47, 155, 255, 0.28);
}

.cover-button:active {
  transform: translateY(-1px) scale(0.98);
}

.cover-mini.city {
  background:
    linear-gradient(90deg, transparent 46%, var(--smw-cover-line) 47% 49%, transparent 50%),
    linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.cover-mini.mist {
  background: linear-gradient(135deg, var(--smw-cover-base), var(--smw-cover-base-deep));
}

.cover-mini.stage {
  background:
    radial-gradient(circle at 60% 25%, var(--smw-cover-dot) 0 2px, transparent 3px),
    var(--smw-cover-base-deep);
}

.cover-mini.desk {
  background: linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.cover-mini.road {
  background: linear-gradient(135deg, var(--smw-cover-base), var(--smw-cover-base-deep));
}

.folder-cover {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
}

.folder-cover > img,
.folder-cover-cell img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.folder-cover.is-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: var(--smw-cover-divider);
}

.folder-cover-cell {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
}

.folder-cover-placeholder-icon {
  width: 38%;
  height: 38%;
  opacity: 0.92;
}

.cover-mini.folder-cover {
  flex: 0 0 42px;
}

</style>
