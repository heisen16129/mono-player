import { ref } from 'vue';
import { listPluginSearchProviders, searchPluginMusic } from '../services/pluginSearch';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';

interface OnlineSearchOptions {
  loadMoreErrorFallback: () => string;
  normalizeErrorMessage: (error: unknown, fallback: string) => string;
  onError: (message: string) => void;
  searchErrorFallback: () => string;
  trackKey: (track: PluginSearchTrack) => string;
}

export function useOnlineSearch({ loadMoreErrorFallback, normalizeErrorMessage, onError, searchErrorFallback, trackKey }: OnlineSearchOptions) {
  const isOnlineSearchOpen = ref(false);
  const isOnlineSearching = ref(false);
  const isOnlineLoadingMore = ref(false);
  const onlineSearchQuery = ref('');
  const onlineSearchError = ref<string | null>(null);
  const onlineLoadMoreError = ref<string | null>(null);
  const onlineSearchProviders = ref<PluginSearchProvider[]>([]);
  const onlineSearchResults = ref<PluginSearchTrack[]>([]);
  const activeOnlineProviderId = ref<string | null>(null);
  const onlineSearchPage = ref(1);
  const onlineSearchHasMore = ref(false);

  function closeOnlineSearchState() {
    isOnlineSearchOpen.value = false;
    onlineSearchError.value = null;
    onlineLoadMoreError.value = null;
    isOnlineLoadingMore.value = false;
    onlineSearchHasMore.value = false;
  }

  async function runOnlineSearch(keyword: string, providerId?: string | null) {
    const query = keyword.trim();
    if (!query) return;

    onlineSearchQuery.value = query;
    isOnlineSearchOpen.value = true;
    isOnlineSearching.value = true;
    onlineSearchError.value = null;
    onlineLoadMoreError.value = null;
    onlineSearchResults.value = [];
    onlineSearchPage.value = 1;
    onlineSearchHasMore.value = false;
    isOnlineLoadingMore.value = false;

    try {
      onlineSearchProviders.value = await listPluginSearchProviders();
      const enabledProviderIds = new Set(onlineSearchProviders.value.filter((provider) => provider.enabled).map((provider) => provider.id));
      const preferredProviderId = providerId ?? activeOnlineProviderId.value;
      const nextProviderId = preferredProviderId && enabledProviderIds.has(preferredProviderId)
        ? preferredProviderId
        : onlineSearchProviders.value.find((provider) => provider.enabled)?.id ?? null;
      activeOnlineProviderId.value = nextProviderId;
      const result = await searchPluginMusic(query, nextProviderId, 1, 30);
      onlineSearchResults.value = result.tracks;
      onlineSearchHasMore.value = !result.isEnd;
    } catch (error) {
      onlineSearchProviders.value = await listPluginSearchProviders();
      const message = normalizeErrorMessage(error, searchErrorFallback());
      onlineSearchError.value = message;
      onError(message);
    } finally {
      isOnlineSearching.value = false;
    }
  }

  async function selectOnlineProvider(providerId: string) {
    if (activeOnlineProviderId.value === providerId || isOnlineSearching.value || isOnlineLoadingMore.value) return;
    activeOnlineProviderId.value = providerId;
    await runOnlineSearch(onlineSearchQuery.value, providerId);
  }

  async function loadMoreOnlineMusic(force = false) {
    if (isOnlineSearching.value || isOnlineLoadingMore.value || !onlineSearchHasMore.value) return;
    if (!force && onlineLoadMoreError.value) return;
    const query = onlineSearchQuery.value.trim();
    if (!query || !activeOnlineProviderId.value) return;

    isOnlineLoadingMore.value = true;
    onlineLoadMoreError.value = null;
    let nextPage = onlineSearchPage.value + 1;

    try {
      const existingKeys = new Set(onlineSearchResults.value.map(trackKey));
      let appendedTracks: PluginSearchTrack[] = [];
      let reachedEnd = false;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await searchPluginMusic(query, activeOnlineProviderId.value, nextPage, 30);
        const nextTracks = result.tracks.filter((track) => !existingKeys.has(trackKey(track)));
        reachedEnd = result.isEnd;

        if (nextTracks.length > 0 || result.isEnd) {
          appendedTracks = nextTracks;
          break;
        }

        nextPage += 1;
      }

      if (appendedTracks.length > 0) {
        onlineSearchResults.value = [...onlineSearchResults.value, ...appendedTracks];
        onlineSearchPage.value = nextPage;
        onlineSearchHasMore.value = !reachedEnd;
      } else {
        onlineSearchPage.value = nextPage;
        onlineSearchHasMore.value = false;
      }
    } catch (error) {
      const message = normalizeErrorMessage(error, loadMoreErrorFallback());
      onlineLoadMoreError.value = message;
      onError(message);
    } finally {
      isOnlineLoadingMore.value = false;
    }
  }

  return {
    activeOnlineProviderId,
    closeOnlineSearchState,
    isOnlineLoadingMore,
    isOnlineSearching,
    isOnlineSearchOpen,
    loadMoreOnlineMusic,
    onlineLoadMoreError,
    onlineSearchError,
    onlineSearchHasMore,
    onlineSearchProviders,
    onlineSearchQuery,
    onlineSearchResults,
    runOnlineSearch,
    selectOnlineProvider,
  };
}
