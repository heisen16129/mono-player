import { ref, type MaybeRefOrGetter, toValue, watch } from 'vue';
import type { Track } from '../types/music';
import { trackArtworkSource, usableArtworkDisplaySrc } from '../utils/artwork';

const failedArtworkUrls = new Set<string>();

export function useTrackCoverThumbUrl(track: MaybeRefOrGetter<Track>) {
  const coverUrl = ref('');

  watch(
    () => trackArtworkSource(toValue(track)),
    (artwork) => {
      coverUrl.value = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    },
    { immediate: true },
  );

  function handleImageError() {
    if (coverUrl.value) failedArtworkUrls.add(coverUrl.value);
    coverUrl.value = '';
  }

  return {
    coverUrl,
    handleImageError,
  };
}
