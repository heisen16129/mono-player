import { computed, ref, type ComputedRef } from 'vue';
import { usableArtworkDisplaySrc } from '../utils/artwork';

const failedArtworkUrls = new Set<string>();

export function useLyricsCover(options: {
  activeArtwork: ComputedRef<string | null | undefined>;
}) {
  const coverUrl = ref('');
  const displayCoverUrl = computed(() => coverUrl.value);
  const backgroundCoverUrl = computed(() => coverUrl.value);

  function clearCoverState() {
    coverUrl.value = '';
  }

  function setArtworkCover(artwork: string) {
    coverUrl.value = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
  }

  function prepareTrackCover(artwork: string | null | undefined = options.activeArtwork.value) {
    coverUrl.value = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
  }

  function clearLyricsCoverCache() {
    coverUrl.value = '';
    failedArtworkUrls.clear();
  }

  function handleCoverError() {
    if (coverUrl.value) failedArtworkUrls.add(coverUrl.value);
    coverUrl.value = '';
  }

  return {
    backgroundCoverUrl,
    clearCoverState,
    clearLyricsCoverCache,
    displayCoverUrl,
    handleCoverError,
    prepareTrackCover,
    setArtworkCover,
  };
}
