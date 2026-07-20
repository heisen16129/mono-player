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

  const lyricProviderTabItems = computed(() => [
    { id: null, label: '全部' },
    ...lyricSearchProviders.value.map((provider) => ({ id: provider.id, label: provider.name, disabled: !provider.enabled })),
  ]);

  function lyricTrackKey(track: PluginSearchTrack) {
    return pluginSearchTrackKey(track);
  }

  function resetLyricSearchPaging() {
    lyricSearchPage.value = 1;
    isLyricSearchEnd.value = true;
    isLoadingMorePluginLyrics.value = false;
  }

  async function openLyricSearchDialog() {
    beforeOpen?.();
    lyricSearchQuery.value = defaultQuery();
    lyricSearchResults.value = [];
    lyricSearchStatus.value = '';
    resetLyricSearchPaging();
    resolvingLyricTrackKey.value = null;
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
  }

  async function selectLyricSearchProvider(providerId: string | null) {
    lyricSearchProviderId.value = providerId;
    await searchPluginLyrics();
  }

  async function searchPluginLyrics() {
    const query = lyricSearchQuery.value.trim();
    if (!query) {
      lyricSearchResults.value = [];
      lyricSearchStatus.value = '请输入歌曲名或歌手';
      resetLyricSearchPaging();
      return;
    }

    isSearchingPluginLyrics.value = true;
    lyricSearchStatus.value = '';
    lyricSearchPage.value = 1;
    isLyricSearchEnd.value = true;
    try {
      const result = await searchPluginLyricsFromProviders(query, lyricSearchProviderId.value, 1, 30);
      lyricSearchResults.value = result.tracks;
      isLyricSearchEnd.value = result.isEnd;
      if (result.tracks.length === 0) {
        lyricSearchStatus.value = '没有找到匹配歌曲';
      }
    } catch (error) {
      lyricSearchResults.value = [];
      isLyricSearchEnd.value = true;
      lyricSearchStatus.value = getErrorMessage(error);
    } finally {
      isSearchingPluginLyrics.value = false;
    }
  }

  async function loadMorePluginLyrics() {
    const query = lyricSearchQuery.value.trim();
    if (!query || isSearchingPluginLyrics.value || isLoadingMorePluginLyrics.value || isLyricSearchEnd.value) return;

    isLoadingMorePluginLyrics.value = true;
    lyricSearchStatus.value = '';
    try {
      const nextPage = lyricSearchPage.value + 1;
      const result = await searchPluginLyricsFromProviders(query, lyricSearchProviderId.value, nextPage, 30);
      const existingKeys = new Set(lyricSearchResults.value.map(lyricTrackKey));
      const nextTracks = result.tracks.filter((track) => !existingKeys.has(lyricTrackKey(track)));
      lyricSearchResults.value = [...lyricSearchResults.value, ...nextTracks];
      lyricSearchPage.value = nextPage;
      isLyricSearchEnd.value = result.isEnd || nextTracks.length === 0;
    } catch (error) {
      lyricSearchStatus.value = getErrorMessage(error);
    } finally {
      isLoadingMorePluginLyrics.value = false;
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
