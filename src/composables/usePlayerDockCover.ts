import { computed, ref, watch, type ComputedRef } from 'vue';
import { playerCoverCacheKey, setPlayerArtworkCoverCache } from '../services/playerCoverCache';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { trackArtworkSource, usableArtworkDisplaySrc } from '../utils/artwork';

interface PlayerDockCoverOptions {
  activeTrack: ComputedRef<Track | null>;
}

export function usePlayerDockCover({ activeTrack }: PlayerDockCoverOptions) {
  const player = usePlayerStore();
  const coverUrl = ref('');
  const failedArtworkUrls = new Set<string>();

  const hasThemeBackground = computed(() => {
    return player.customThemes.some((theme) => theme.id === player.settings.theme && Boolean(theme.background));
  });
  const dockStyle = computed(() => ({
    '--dock-cover-bg': coverUrl.value ? `url("${coverUrl.value}")` : undefined,
  }));

  watch(
    () => [
      trackArtworkSource(activeTrack.value),
      activeTrack.value?.coverVersion,
    ] as const,
    ([artwork]) => {
      coverUrl.value = '';

      const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
      if (artworkUrl) {
        coverUrl.value = artworkUrl;
        setPlayerArtworkCoverCache(playerCoverCacheKey(activeTrack.value), artworkUrl);
      }
    },
    { immediate: true },
  );

  function handleCoverError() {
    const failedUrl = coverUrl.value;
    if (failedUrl) {
      failedArtworkUrls.add(failedUrl);
    }
    coverUrl.value = '';
  }

  return {
    coverUrl,
    dockStyle,
    handleCoverError,
    hasThemeBackground,
  };
}
