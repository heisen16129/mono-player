import { onBeforeUnmount, watch, type Ref } from 'vue';
import type { Track } from '../types/music';

interface UseLyricsRendererPreloadOptions {
  activeTrack: Readonly<Ref<Track | null | undefined>>;
  hasMountedLyrics: Readonly<Ref<boolean>>;
  hydrateRendererSettings: () => Promise<void>;
  isAppReady: Readonly<Ref<boolean>>;
  mountLyrics: () => void;
}

const PRELOAD_DELAY_MS = 400;

export function useLyricsRendererPreload({
  activeTrack,
  hasMountedLyrics,
  hydrateRendererSettings,
  isAppReady,
  mountLyrics,
}: UseLyricsRendererPreloadOptions) {
  let preloadTimer: ReturnType<typeof setTimeout> | null = null;
  let isPreparingPreload = false;

  function clearPreloadTimer() {
    if (preloadTimer === null) return;
    clearTimeout(preloadTimer);
    preloadTimer = null;
  }

  async function preparePreload() {
    if (
      isPreparingPreload
      || preloadTimer !== null
      || !isAppReady.value
      || !activeTrack.value
      || hasMountedLyrics.value
    ) return;

    isPreparingPreload = true;
    try {
      try {
        await hydrateRendererSettings();
      } catch (error) {
        console.warn('[LyricsRenderer] preload settings hydration failed', error);
      }
      if (!isAppReady.value || !activeTrack.value || hasMountedLyrics.value) return;
      preloadTimer = setTimeout(() => {
        preloadTimer = null;
        if (isAppReady.value && activeTrack.value && !hasMountedLyrics.value) {
          mountLyrics();
        }
      }, PRELOAD_DELAY_MS);
    } finally {
      isPreparingPreload = false;
    }
  }

  watch(
    [isAppReady, activeTrack, hasMountedLyrics],
    () => {
      if (hasMountedLyrics.value || !activeTrack.value) {
        clearPreloadTimer();
        return;
      }
      void preparePreload();
    },
    { immediate: true },
  );

  onBeforeUnmount(clearPreloadTimer);
}
