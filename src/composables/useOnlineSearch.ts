import { ref } from 'vue';
import { listPluginSearchProviders, searchPluginMusic } from '../services/pluginSearch';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';

interface OnlineSearchOptions {
  loadMoreErrorFallback: () => string;
  normalizeErrorMessage: (error: unknown, fallback: string) => string;
  onError: (message: string) => void;
  searchErrorFallback: () => string;
}

export function useOnlineSearch({ loadMoreErrorFallback, normalizeErrorMessage, onError, searchErrorFallback }: OnlineSearchOptions) {
  const isOnlineSearchOpen = ref(false);
  const isOnlineSearching = ref(false);
  const isOnlineLoadingMore = ref(false);
  const onlineSearchQuery = ref('');
  const onlineSearchError = ref<string | null>(null);
  const onlineLoadMoreError = ref<string | null>(null);
  const onlineSearchProviders = ref<PluginSearchProvider[]>([]);
  const onlineSearchResults = ref<PluginSearchTrack[]>([]);
  const activeOnlineProviderId = ref<string | null>(null);
  let requestGeneration = 0;
  let sessionId: string | null = null;
  const onlineSearchHasMore = ref(false);

  function closeOnlineSearchState() {
    requestGeneration += 1;
    sessionId = null;
    isOnlineSearching.value = false;
    isOnlineSearchOpen.value = false;
    onlineSearchError.value = null;
    onlineLoadMoreError.value = null;
    isOnlineLoadingMore.value = false;
    onlineSearchHasMore.value = false;
  }

  async function runOnlineSearch(keyword: string, providerId?: string | null) {
    const query = keyword.trim();
    if (!query) return;

    const generation = ++requestGeneration;
    sessionId = null;
    onlineSearchQuery.value = query;
    isOnlineSearchOpen.value = true;
    isOnlineSearching.value = true;
    onlineSearchError.value = null;
    onlineLoadMoreError.value = null;
    onlineSearchResults.value = [];
    onlineSearchHasMore.value = false;
    isOnlineLoadingMore.value = false;

    try {
      const providers = await listPluginSearchProviders();
      if (generation !== requestGeneration) return;
      onlineSearchProviders.value = providers;
      const enabledProviderIds = new Set(onlineSearchProviders.value.filter((provider) => provider.enabled).map((provider) => provider.id));
      const preferredProviderId = providerId ?? activeOnlineProviderId.value;
      const nextProviderId = preferredProviderId && enabledProviderIds.has(preferredProviderId)
        ? preferredProviderId
        : onlineSearchProviders.value.find((provider) => provider.enabled)?.id ?? null;
      activeOnlineProviderId.value = nextProviderId;
      if (!nextProviderId) throw new Error('没有启用支持音乐搜索的插件');
      const result = await searchPluginMusic(query, nextProviderId);
      if (generation !== requestGeneration) return;
      sessionId = result.sessionId;
      onlineSearchResults.value = result.tracks;
      onlineSearchHasMore.value = !result.isEnd;
    } catch (error) {
      if (generation !== requestGeneration) return;
      const message = normalizeErrorMessage(error, searchErrorFallback());
      onlineSearchError.value = message;
      onError(message);
    } finally {
      if (generation === requestGeneration) isOnlineSearching.value = false;
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
    const generation = requestGeneration;

    try {
      if (!sessionId) return;
      const result = await searchPluginMusic(query, activeOnlineProviderId.value, sessionId);
      if (generation !== requestGeneration) return;
      onlineSearchResults.value = result.tracks;
      onlineSearchHasMore.value = !result.isEnd;
    } catch (error) {
      if (generation !== requestGeneration) return;
      const message = normalizeErrorMessage(error, loadMoreErrorFallback());
      onlineLoadMoreError.value = message;
      onError(message);
    } finally {
      if (generation === requestGeneration) isOnlineLoadingMore.value = false;
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
