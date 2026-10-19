import { computed, ref } from 'vue';
import { listPluginLyricSearchProviders, searchPluginLyrics as searchPluginLyricsFromProviders } from '../services/pluginSearch';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import { pluginSearchTrackKey } from '../utils/trackKey';

interface LyricsSearchOptions {
  defaultQuery: () => string;
  beforeOpen?: () => void;
}

export function useLyricsSearch({ beforeOpen, defaultQuery }: LyricsSearchOptions) {
  const isSearchDialogOpen = ref(false);
  const lyricSearchQuery = ref('');
  const lyricSearchResults = ref<PluginSearchTrack[]>([]);
  const lyricSearchProviders = ref<PluginSearchProvider[]>([]);
  const lyricSearchProviderId = ref<string | null>(null);
  const lyricSearchStatus = ref('');
  const isSearchingPluginLyrics = ref(false);
  const isLoadingMorePluginLyrics = ref(false);
  let sessionId: string | null = null;
  let submittedQuery = '';
  const isLyricSearchEnd = ref(true);
  const resolvingLyricTrackKey = ref<string | null>(null);
  let lyricSearchRequestId = 0;

  const lyricProviderTabItems = computed(() => [
    { id: null, label: '全部' },
    ...lyricSearchProviders.value.map((provider) => ({ id: provider.id, label: provider.name, disabled: !provider.enabled })),
  ].filter((item) => item.id !== null));

  function lyricTrackKey(track: PluginSearchTrack) {
    return pluginSearchTrackKey(track);
  }

  function resetLyricSearchPaging() {
    sessionId = null;
    submittedQuery = '';
    isLyricSearchEnd.value = true;
    isLoadingMorePluginLyrics.value = false;
  }

  function nextLyricSearchRequestId() {
    lyricSearchRequestId += 1;
    return lyricSearchRequestId;
  }

  async function openLyricSearchDialog() {
    beforeOpen?.();
    lyricSearchQuery.value = defaultQuery();
    lyricSearchResults.value = [];
    lyricSearchStatus.value = '';
    resetLyricSearchPaging();
    resolvingLyricTrackKey.value = null;
    const requestId = nextLyricSearchRequestId();
    isSearchingPluginLyrics.value = false;
    isSearchDialogOpen.value = true;

    try {
      const providers = await listPluginLyricSearchProviders();
      if (requestId !== lyricSearchRequestId) return;
      lyricSearchProviders.value = providers;
      const enabledProvider = lyricSearchProviders.value.find((provider) => provider.enabled);
      lyricSearchProviderId.value = enabledProvider?.id ?? null;
      if (lyricSearchQuery.value) {
        await searchPluginLyrics();
      }
    } catch (error) {
      if (requestId !== lyricSearchRequestId) return;
      lyricSearchStatus.value = getErrorMessage(error);
    }
  }

  function closeLyricSearchDialog() {
    isSearchDialogOpen.value = false;
    isSearchingPluginLyrics.value = false;
    sessionId = null;
    isLoadingMorePluginLyrics.value = false;
    resolvingLyricTrackKey.value = null;
    nextLyricSearchRequestId();
  }

  async function selectLyricSearchProvider(providerId: string | null) {
    if (!providerId || providerId === lyricSearchProviderId.value) return;
    lyricSearchProviderId.value = providerId;
    await searchPluginLyrics();
  }

  async function searchPluginLyrics() {
    const query = lyricSearchQuery.value.trim();
    const providerId = lyricSearchProviderId.value;
    const requestId = nextLyricSearchRequestId();
    if (!query || !providerId) {
      isSearchingPluginLyrics.value = false;
      lyricSearchResults.value = [];
      lyricSearchStatus.value = !query ? '请输入歌曲名或歌手' : '没有启用支持歌词搜索的插件';
      resetLyricSearchPaging();
      return;
    }

    isSearchingPluginLyrics.value = true;
    lyricSearchStatus.value = '';
    lyricSearchResults.value = [];
    sessionId = null;
    submittedQuery = '';
    isLyricSearchEnd.value = true;
    isLoadingMorePluginLyrics.value = false;
    try {
      const result = await searchPluginLyricsFromProviders(query, providerId);
      if (requestId !== lyricSearchRequestId) return;
      sessionId = result.sessionId;
      submittedQuery = query;
      lyricSearchResults.value = result.tracks;
      isLyricSearchEnd.value = result.isEnd;
      if (result.tracks.length === 0) {
        lyricSearchStatus.value = '没有找到匹配歌曲';
      }
    } catch (error) {
      if (requestId !== lyricSearchRequestId) return;
      lyricSearchResults.value = [];
      isLyricSearchEnd.value = true;
      lyricSearchStatus.value = getErrorMessage(error);
    } finally {
      if (requestId === lyricSearchRequestId) {
        isSearchingPluginLyrics.value = false;
      }
    }
  }

  async function loadMorePluginLyrics() {
    const providerId = lyricSearchProviderId.value;
    if (!sessionId || !providerId || isSearchingPluginLyrics.value || isLoadingMorePluginLyrics.value || isLyricSearchEnd.value) return;

    isLoadingMorePluginLyrics.value = true;
    lyricSearchStatus.value = '';
    const requestId = lyricSearchRequestId;
    try {
      const result = await searchPluginLyricsFromProviders(submittedQuery, providerId, sessionId);
      if (requestId !== lyricSearchRequestId) return;
      lyricSearchResults.value = result.tracks;
      isLyricSearchEnd.value = result.isEnd;
    } catch (error) {
      if (requestId !== lyricSearchRequestId) return;
      lyricSearchStatus.value = getErrorMessage(error);
    } finally {
      if (requestId === lyricSearchRequestId) {
        isLoadingMorePluginLyrics.value = false;
      }
    }
  }

  function handleLyricSearchResultsScroll(event: Event) {
    const target = event.currentTarget as HTMLElement;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 96) {
      void loadMorePluginLyrics();
    }
  }

  return {
    closeLyricSearchDialog,
    handleLyricSearchResultsScroll,
    isLoadingMorePluginLyrics,
    isSearchDialogOpen,
    isSearchingPluginLyrics,
    lyricProviderTabItems,
    lyricSearchProviderId,
    lyricSearchProviders,
    lyricSearchQuery,
    lyricSearchResults,
    lyricSearchStatus,
    lyricTrackKey,
    openLyricSearchDialog,
    resolvingLyricTrackKey,
    searchPluginLyrics,
    selectLyricSearchProvider,
  };
}
