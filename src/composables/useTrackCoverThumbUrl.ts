import { ref, type MaybeRefOrGetter, toValue, watch } from 'vue';
import type { Track } from '../types/music';
import { trackArtworkSource, usableArtworkDisplaySrc } from '../utils/artwork';

const failedArtworkUrls = new Set<string>();

export function useTrackCoverThumbUrl(track: MaybeRefOrGetter<Track>) {
  const coverUrl = ref('');

  watch(
    () => [trackArtworkSource(toValue(track)), toValue(track).coverVersion] as const,
    ([artwork, coverVersion]) => {
      coverUrl.value = usableArtworkDisplaySrc(artwork, failedArtworkUrls, coverVersion);
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
