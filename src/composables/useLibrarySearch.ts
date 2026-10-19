import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { searchLibrary, type LibrarySearchResult } from '../services/librarySearch';
import { isTauriRuntime } from '../services/music';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';

export function useLibrarySearch({ tracks, latestAddedTracks, recentPlayedTracks, query, error }: {
  tracks: Ref<Track[]>;
  latestAddedTracks: Ref<Track[]>;
  recentPlayedTracks: Ref<Track[]>;
  query: Ref<string>;
  error: Ref<string | null>;
}) {
  const emptyStatistics = () => ({ tracks: { count: 0, totalSeconds: 0 }, latestAddedTracks: { count: 0, totalSeconds: 0 }, recentPlayedTracks: { count: 0, totalSeconds: 0 } });
  const result = ref<LibrarySearchResult>({ statistics: emptyStatistics(), totals: emptyStatistics(), tracks: [], latestAddedTracks: [], recentPlayedTracks: [] });
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function refreshLibrarySearch(requestRevision = ++revision) {
    clearTimeout(timer);
    if (!isTauriRuntime()) return;
    try {
      const next = await searchLibrary(query.value);
      if (requestRevision === revision) result.value = next;
    } catch (err) {
      if (requestRevision === revision) error.value = getErrorMessage(err);
    }
  }

  watch(
    () => [tracks.value, latestAddedTracks.value, recentPlayedTracks.value, query.value],
    () => {
      const requestRevision = ++revision;
      clearTimeout(timer);
      if (!isTauriRuntime()) return;
      timer = setTimeout(() => refreshLibrarySearch(requestRevision), 100);
    },
    { immediate: true, deep: true },
  );
  onScopeDispose(() => { ++revision; clearTimeout(timer); });
  return {
    refreshLibrarySearch,
    libraryListStatistics: computed(() => result.value.statistics),
    libraryListTotals: computed(() => result.value.totals),
    filteredTracks: computed(() => result.value.tracks),
    filteredLatestAddedTracks: computed(() => result.value.latestAddedTracks),
    filteredRecentPlayedTracks: computed(() => result.value.recentPlayedTracks),
  };
}
