<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useOnlineSearch } from '../composables/useOnlineSearch';
import { useSearchHistory } from '../composables/useSearchHistory';
import { resolveLocale } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { OnlineSearchSnapshot } from '../types/onlineSearch';
import type { PluginSearchTrack } from '../types/plugin';
import type { DiscoverMusicPageEmits, DiscoverMusicPageProps, PluginSearchViewProps } from '../types/discoverMusicPage';
import { getErrorMessage } from '../utils/error';
import { createOnlineQueueTrack } from '../utils/onlineTrack';
import DiscoverMusicView from './DiscoverMusicView.vue';
import PluginSearchView from './PluginSearchView.vue';

const props = defineProps<DiscoverMusicPageProps>();

const emit = defineEmits<DiscoverMusicPageEmits>();

const player = usePlayerStore();
const searchHistoryLimitRef = computed(() => Math.max(1, Math.round(player.settings.searchHistoryLimit)));
const {
  clearSearchHistory,
  loadSearchHistory,
  removeSearchHistory,
  saveSearchHistory,
  searchHistory,
} = useSearchHistory(searchHistoryLimitRef);
const {
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
} = useOnlineSearch({
  loadMoreErrorFallback: () => (resolveLocale(player.settings.locale) === 'en-US' ? 'Failed to load more results.' : '加载更多失败'),
  normalizeErrorMessage: normalizeOnlineErrorMessage,
  onError: (message) => emit('notify', message),
  searchErrorFallback: () => (resolveLocale(player.settings.locale) === 'en-US' ? 'Plugin search failed.' : '插件搜索失败'),
  trackKey: getOnlineTrackKey,
});

watch(
  () => props.searchError,
  (message) => {
    if (message) onlineSearchError.value = message;
  },
);

watch(
  [activeOnlineProviderId, isOnlineSearchOpen, onlineSearchQuery, onlineSearchResults],
  () => emit('searchUpdated', createSearchSnapshot()),
  { deep: true },
);

onMounted(async () => {
  await loadSearchHistory();
  emit('searchReady', createSearchSnapshot());
});

function normalizeOnlineErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  if (
    message === 'Plugin for selected track is not installed.'
    || message === '插件未安装或已停用，无法播放当前在线歌曲。'
  ) {
    return resolveLocale(player.settings.locale) === 'en-US'
      ? 'The plugin for this track is not installed or enabled. Open Plugin Manager and enable it before playing.'
      : '插件未安装或已停用，请到插件管理安装/启用后再播放。';
  }
  return message || fallback;
}

function getOnlineTrackKey(track: PluginSearchTrack) {
  return `${track.providerId}:${track.id}`;
}

function createSearchSnapshot(): OnlineSearchSnapshot {
  return {
    activeProviderId: activeOnlineProviderId.value,
    isOpen: isOnlineSearchOpen.value,
    query: onlineSearchQuery.value,
    results: onlineSearchResults.value,
  };
}

async function searchOnlineMusic(keyword: string, providerId?: string | null) {
  if (!player.settings.enablePlugins) {
    emit('notify', resolveLocale(player.settings.locale) === 'en-US' ? 'Enable plugins before using online music.' : '请先启用插件。', 'error');
    return;
  }

  const query = keyword.trim();
  if (!query) return;

  emit('searchStarted');
  await saveSearchHistory(query);
  await runOnlineSearch(query, providerId);
}

async function retrySearch() {
  await searchOnlineMusic(onlineSearchQuery.value);
}

function clearSearch() {
  closeOnlineSearchState();
  emit('searchUpdated', createSearchSnapshot());
  emit('backLocal');
}

const pluginSearchViewProps = computed<PluginSearchViewProps>(() => ({
  activeProviderId: activeOnlineProviderId.value,
  activePlaybackTrack: props.activePlaybackTrack,
  activeTrackKey: props.activeTrackKey,
  downloadedTrackKeys: props.downloadedTrackKeys,
  pendingDownloadTrackKeys: props.pendingDownloadTrackKeys,
  error: onlineSearchError.value,
  favoriteTrackIds: props.favoriteTrackIds,
  hasMore: onlineSearchHasMore.value,
  isPlaying: props.isPlaying,
  loadMoreError: onlineLoadMoreError.value,
  loading: isOnlineSearching.value,
  loadingMore: isOnlineLoadingMore.value,
  providers: onlineSearchProviders.value,
  query: onlineSearchQuery.value,
  resolvingTrackKey: props.resolvingTrackKey,
  results: onlineSearchResults.value,
  searchHistory: searchHistory.value,
}));
</script>

<template>
  <PluginSearchView
    v-if="isOnlineSearchOpen"
    v-bind="pluginSearchViewProps"
    @back-local="clearSearch"
    @clear-search-history="clearSearchHistory"
    @download-track="emit('downloadTrack', createOnlineQueueTrack($event))"
    @load-more="loadMoreOnlineMusic(false)"
    @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
    @retry="retrySearch"
    @retry-load-more="loadMoreOnlineMusic(true)"
    @search="searchOnlineMusic"
    @remove-search-history="removeSearchHistory"
    @select-provider="selectOnlineProvider"
    @toggle-favorite="emit('toggleFavorite', $event)"
    @play-track="emit('playTrack', $event)"
  />
  <DiscoverMusicView
    v-else
    v-model="onlineSearchQuery"
    :search-history="searchHistory"
    @remove-search-history="removeSearchHistory"
    @search="searchOnlineMusic"
  />
</template>

