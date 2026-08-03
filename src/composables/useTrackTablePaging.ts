import type { ComponentPublicInstance, MaybeRefOrGetter } from 'vue';
import { computed, nextTick, ref, toValue, watch } from 'vue';
import type { Track } from '../types/music';

const DEFAULT_PAGE_SIZE = 30;

interface TrackTablePagingOptions {
  disableInternalPaging?: MaybeRefOrGetter<boolean | undefined>;
  pageSize?: number;
  tracks: MaybeRefOrGetter<Track[]>;
}

export function useTrackTablePaging(options: TrackTablePagingOptions) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const trackRowRefs = ref(new Map<number, HTMLElement>());
  const visibleCount = ref(toValue(options.disableInternalPaging) ? toValue(options.tracks).length : pageSize);
  const visibleTracks = computed(() => {
    const tracks = toValue(options.tracks);
    return toValue(options.disableInternalPaging) ? tracks : tracks.slice(0, visibleCount.value);
  });
  const hasMoreTracks = computed(() => {
    return !toValue(options.disableInternalPaging) && visibleCount.value < toValue(options.tracks).length;
  });

  watch(
    () => [toValue(options.tracks), toValue(options.disableInternalPaging)] as const,
    () => {
      visibleCount.value = toValue(options.disableInternalPaging) ? toValue(options.tracks).length : pageSize;
      trackRowRefs.value.clear();
    },
  );

  function setTrackRowRef(trackId: number, element: Element | ComponentPublicInstance | null) {
    if (element instanceof HTMLElement) {
      trackRowRefs.value.set(trackId, element);
      return;
    }

    trackRowRefs.value.delete(trackId);
  }

  async function scrollToTrack(trackId: number) {
    const tracks = toValue(options.tracks);
    const trackIndex = tracks.findIndex((track) => track.id === trackId);
    if (trackIndex >= visibleCount.value) {
      visibleCount.value = Math.ceil((trackIndex + 1) / pageSize) * pageSize;
    }

    await nextTick();
    trackRowRefs.value.get(trackId)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }

  function loadNextPage() {
    const tracks = toValue(options.tracks);
    if (!hasMoreTracks.value) return;
    visibleCount.value = Math.min(tracks.length, visibleCount.value + pageSize);
  }

  return {
    hasMoreTracks,
    loadNextPage,
    scrollToTrack,
    setTrackRowRef,
    visibleTracks,
  };
}
