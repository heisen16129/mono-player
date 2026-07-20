import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from 'vue';
import { readCover, readCoverThumbnail } from '../services/music';
import { clearPlayerOriginalCoverCache, playerCoverCacheKey, setPlayerArtworkCoverCache, setPlayerOriginalCoverCache } from '../services/playerCoverCache';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';

interface PlayerDockCoverOptions {
  activeTrack: ComputedRef<Track | null>;
}

export function usePlayerDockCover({ activeTrack }: PlayerDockCoverOptions) {
  const player = usePlayerStore();
  const coverUrl = ref('');
  const failedArtworkUrls = new Set<string>();
  let coverLoadId = 0;

  const hasThemeBackground = computed(() => {
    return player.customThemes.some((theme) => theme.id === player.settings.theme && Boolean(theme.background));
  });
  const dockStyle = computed(() => ({
    '--dock-cover-bg': coverUrl.value ? `url("${coverUrl.value}")` : undefined,
  }));

  async function cachePlayerOriginalCover(path: string, cacheKey: string, loadId: number) {
    try {
      const cover = await readCover(path);
      if (loadId !== coverLoadId) return;

      clearPlayerOriginalCoverCache();
      if (!cover?.data.length) return;
      setPlayerOriginalCoverCache(cacheKey, cover);
    } catch {
      if (loadId === coverLoadId) {
        clearPlayerOriginalCoverCache();
      }
    }
  }

  watch(
    () => [activeTrack.value?.path, activeTrack.value?.artwork, activeTrack.value?.coverVersion] as const,
    async ([path, artwork]) => {
      const currentLoadId = ++coverLoadId;
      if (coverUrl.value) {
        revokeTemporaryObjectUrl(coverUrl.value);
      }
      coverUrl.value = '';

      const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
      if (artworkUrl) {
        coverUrl.value = artworkUrl;
        setPlayerArtworkCoverCache(playerCoverCacheKey(activeTrack.value), artworkUrl);
        return;
      }

      if (!path) {
        clearPlayerOriginalCoverCache();
        return;
      }
      const cacheKey = playerCoverCacheKey(activeTrack.value);
      clearPlayerOriginalCoverCache();

      try {
        const cover = await readCoverThumbnail(path);
        if (currentLoadId !== coverLoadId) return;
        coverUrl.value = coverImageObjectUrl(cover) ?? '';
      } catch {
        coverUrl.value = '';
      }

      if (currentLoadId === coverLoadId) {
        void cachePlayerOriginalCover(path, cacheKey, currentLoadId);
      }
    },
    { immediate: true },
  );

  function handleCoverError() {
    const failedUrl = coverUrl.value;
    if (failedUrl) {
      if (isTemporaryObjectUrl(failedUrl)) {
        revokeTemporaryObjectUrl(failedUrl);
      } else {
        failedArtworkUrls.add(failedUrl);
      }
    }
    coverUrl.value = '';
    coverLoadId += 1;
    const track = activeTrack.value;
    if (!track?.path) return;
    void (async () => {
      const currentLoadId = coverLoadId;
      try {
        const cover = await readCoverThumbnail(track.path);
        if (currentLoadId !== coverLoadId) return;
        coverUrl.value = coverImageObjectUrl(cover) ?? '';
      } catch {
        coverUrl.value = '';
      }
    })();
  }

  onBeforeUnmount(() => {
    if (coverUrl.value) {
      revokeTemporaryObjectUrl(coverUrl.value);
    }
    clearPlayerOriginalCoverCache();
  });

  return {
    coverUrl,
    dockStyle,
    handleCoverError,
    hasThemeBackground,
  };
}
