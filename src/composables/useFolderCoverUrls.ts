import { computed, ref, type Ref } from 'vue';
import type { Track } from '../types/music';
import { recoverTrackCover } from '../services/coverRecovery';
import { trackArtworkSource, usableArtworkDisplaySrc } from '../utils/artwork';

function coverCandidates(tracks: Track[]) {
  return tracks.length >= 4
    ? tracks.slice(0, 4)
    : tracks.filter((track) => track.path).slice(0, 4);
}

export function useFolderCoverUrls(tracks: Ref<Track[]>) {
  const failedArtworkUrls = ref(new Set<string>());
  const shouldUseGrid = computed(() => tracks.value.length >= 4);
  const visibleCovers = computed(() => {
    const covers = coverCandidates(tracks.value).map((track) => (
      usableArtworkDisplaySrc(trackArtworkSource(track), failedArtworkUrls.value, track.coverVersion) || null
    ));
    return shouldUseGrid.value
      ? covers.slice(0, 4)
      : covers.filter((url): url is string => Boolean(url)).slice(0, 1);
  });

  function handleCoverError(index: number) {
    const failedUrl = visibleCovers.value[index];
    if (!failedUrl) return;
    const nextFailedUrls = new Set(failedArtworkUrls.value);
    nextFailedUrls.add(failedUrl);
    failedArtworkUrls.value = nextFailedUrls;
    const track = coverCandidates(tracks.value)[index];
    if (track) void recoverTrackCover(track);
  }

  return {
    handleCoverError,
    shouldUseGrid,
    visibleCovers,
  };
}
