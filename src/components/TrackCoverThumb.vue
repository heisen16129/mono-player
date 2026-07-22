<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { readCoverThumbnail } from '../services/music';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';
import DefaultCover from './DefaultCover.vue';

const MAX_CACHED_COVERS = 360;
const coverUrlCache = new Map<string, string | null>();
const coverRequestCache = new Map<string, Promise<string | null>>();
const failedArtworkUrls = new Set<string>();
const MAX_CONCURRENT_COVER_READS = 5;
let activeCoverReads = 0;
const pendingCoverReads: Array<() => void> = [];

const props = defineProps<{
  track: Track;
  active?: boolean;
  loading?: boolean;
  playing?: boolean;
  spectrumLevels?: number[];
}>();

const coverUrl = ref('');
const coverRoot = ref<HTMLElement | null>(null);
const isVisible = ref(false);
let loadId = 0;
let observer: IntersectionObserver | null = null;
let lastSpectrumDebugAt = 0;
const PLAYING_BAR_HEIGHTS = [8, 12, 17, 12, 8];
const PAUSED_BAR_HEIGHT = 12;
const PAUSED_BAR_SCALE = 0.16;

const spectrumBars = computed(() => {
  return Array.from({ length: 5 }, (_, index) => {
    if (props.loading) {
      return {};
    }

    if (!props.playing) {
      return { transform: 'scaleY(0.16)' };
    }

    const fallback = [0.38, 0.72, 0.52, 0.82, 0.42];
    const value = props.spectrumLevels?.[index];
    const level = typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0.08, Math.min(1, value))
      : fallback[index];
    const minScale = (PAUSED_BAR_HEIGHT * PAUSED_BAR_SCALE) / PLAYING_BAR_HEIGHTS[index];
    return {
      transform: `scaleY(${Math.min(1, Math.max(minScale, level * 0.5))})`,
    };
  });
});

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

watch(
  () => [props.track.id, props.track.path, props.track.artwork, props.track.coverVersion] as const,
  ([id, path, artwork, coverVersion]) => {
    void loadCover(id, path, artwork, coverVersion);
  },
  { immediate: true },
);

watch(isVisible, (visible) => {
  if (!visible || coverUrl.value) return;
  void loadCover(props.track.id, props.track.path, props.track.artwork, props.track.coverVersion);
});

watch(
  () => [props.active, props.playing, props.spectrumLevels] as const,
  ([active, playing, levels]) => {
    if (!active || !playing) return;
    const now = window.performance.now();
    if (now - lastSpectrumDebugAt < 1000) return;
    lastSpectrumDebugAt = now;
    const peak = (levels ?? []).reduce((max, value) => Math.max(max, value), 0);
    console.debug('[cover-spectrum]', {
      trackId: props.track.id,
      title: props.track.title,
      peak,
      levels: levels ?? [],
      bars: spectrumBars.value,
    });
  },
);

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
  void loadCover(props.track.id, props.track.path, props.track.artwork, props.track.coverVersion);
}
</script>

<template>
  <span ref="coverRoot" class="track-cover-thumb" :class="{ 'has-cover': coverUrl, active, loading, playing }" aria-hidden="true">
    <img v-if="coverUrl" :src="coverUrl" alt="" @error="handleImageError" />
    <DefaultCover v-else-if="!active && !loading" class="cover-placeholder-icon" :size="18" :stroke-width="2.4" />
    <span v-if="active || loading" class="cover-equalizer" :class="{ 'is-playing': playing, 'is-loading': loading }">
      <i v-for="(bar, index) in spectrumBars" :key="index" :style="bar"></i>
    </span>
  </span>
</template>

<style scoped>
.track-cover-thumb {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--smw-border, #d8e3f2) 72%, transparent);
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
}

.track-cover-thumb.active::after,
.track-cover-thumb.loading::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: color-mix(in srgb, #000 42%, transparent);
  content: "";
}

.track-cover-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.cover-equalizer {
  position: absolute;
  z-index: 1;
  left: 50%;
  top: 50%;
  display: inline-flex;
  width: 18px;
  height: 17px;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: #fff;
  transform: translate(-50%, -50%);
}

.cover-equalizer i {
  width: 2px;
  height: 17px;
  border-radius: 3px;
  background: currentColor;
  box-shadow: 0 0 8px color-mix(in srgb, currentColor 38%, transparent);
  opacity: 0.96;
  transform-origin: center;
  transition: transform 90ms linear;
}

.cover-equalizer i:nth-child(1) {
  height: 8px;
}

.cover-equalizer i:nth-child(2) {
  height: 12px;
}

.cover-equalizer i:nth-child(3) {
  height: 17px;
}

.cover-equalizer i:nth-child(4) {
  height: 12px;
}

.cover-equalizer i:nth-child(5) {
  height: 8px;
}

.cover-equalizer:not(.is-playing):not(.is-loading) i {
  height: 12px;
}

.cover-equalizer.is-playing i {
  border-radius: 4px;
  transition-duration: 70ms;
}

.cover-equalizer.is-loading i {
  height: 17px;
  transform: scaleY(0.16);
}

.cover-equalizer.is-loading i:nth-child(1) {
  animation: cover-loading-wave-1 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(2) {
  animation: cover-loading-wave-2 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(3) {
  animation: cover-loading-wave-3 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(4) {
  animation: cover-loading-wave-4 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(5) {
  animation: cover-loading-wave-5 900ms ease-in-out infinite;
}

@keyframes cover-loading-wave-1 {
  0%, 32%, 100% { transform: scaleY(0.16); }
  16% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-2 {
  0%, 12%, 44%, 100% { transform: scaleY(0.16); }
  28% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-3 {
  0%, 24%, 56%, 100% { transform: scaleY(0.16); }
  40% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-4 {
  0%, 36%, 68%, 100% { transform: scaleY(0.16); }
  52% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-5 {
  0%, 48%, 80%, 100% { transform: scaleY(0.16); }
  64% { transform: scaleY(0.5); }
}
</style>
