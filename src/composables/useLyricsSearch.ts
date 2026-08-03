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
  const lyricSearchPage = ref(1);
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
    lyricSearchPage.value = 1;
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
    nextLyricSearchRequestId();
    isSearchDialogOpen.value = true;

    try {
      lyricSearchProviders.value = await listPluginLyricSearchProviders();
      const enabledProvider = lyricSearchProviders.value.find((provider) => provider.enabled);
      lyricSearchProviderId.value = enabledProvider?.id ?? null;
      if (lyricSearchQuery.value) {
        await searchPluginLyrics();
      }
    } catch (error) {
      lyricSearchStatus.value = getErrorMessage(error);
    }
  }

  function closeLyricSearchDialog() {
    isSearchDialogOpen.value = false;
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
    if (!query) {
      lyricSearchResults.value = [];
      lyricSearchStatus.value = '请输入歌曲名或歌手';
      resetLyricSearchPaging();
      return;
    }

    isSearchingPluginLyrics.value = true;
    lyricSearchStatus.value = '';
    lyricSearchResults.value = [];
    lyricSearchPage.value = 1;
    isLyricSearchEnd.value = true;
    isLoadingMorePluginLyrics.value = false;
    try {
      const result = await searchPluginLyricsFromProviders(query, providerId, 1, 30);
      if (requestId !== lyricSearchRequestId) return;
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
    const query = lyricSearchQuery.value.trim();
    if (!query || isSearchingPluginLyrics.value || isLoadingMorePluginLyrics.value || isLyricSearchEnd.value) return;

    isLoadingMorePluginLyrics.value = true;
    lyricSearchStatus.value = '';
    const providerId = lyricSearchProviderId.value;
    const requestId = lyricSearchRequestId;
    try {
      const nextPage = lyricSearchPage.value + 1;
      const result = await searchPluginLyricsFromProviders(query, providerId, nextPage, 30);
      if (requestId !== lyricSearchRequestId) return;
      const existingKeys = new Set(lyricSearchResults.value.map(lyricTrackKey));
      const nextTracks = result.tracks.filter((track) => !existingKeys.has(lyricTrackKey(track)));
      lyricSearchResults.value = [...lyricSearchResults.value, ...nextTracks];
      lyricSearchPage.value = nextPage;
      isLyricSearchEnd.value = result.isEnd || nextTracks.length === 0;
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
