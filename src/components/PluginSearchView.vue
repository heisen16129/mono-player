<script setup lang="ts">
import { RotateCcw } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { useScrollingState } from '../composables/useScrollingState';
import type { Track } from '../types/music';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
import { pluginSearchTrackId, pluginSearchTrackKey } from '../utils/trackKey';
import EmptyState from './EmptyState.vue';
import LoadingState from './LoadingState.vue';
import SegmentTabs from './SegmentTabs.vue';
import SearchInput from './SearchInput.vue';
import SpinnerIcon from './SpinnerIcon.vue';
import TrackTable from './TrackTable.vue';

const props = defineProps<{
  activeProviderId: string | null;
  activePlaybackTrack: Track | null;
  activeTrackKey: string | null;
  downloadedTrackKeys: string[];
  pendingDownloadTrackKeys: string[];
  error: string | null;
  favoriteTrackIds: number[];
  hasMore: boolean;
  isPlaying: boolean;
  spectrumLevels: number[];
  loadMoreError: string | null;
  loading: boolean;
  loadingMore: boolean;
  providers: PluginSearchProvider[];
  query: string;
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
}>();

const emit = defineEmits<{
  retry: [];
  backLocal: [];
  downloadTrack: [track: PluginSearchTrack];
  loadMore: [];
  retryLoadMore: [];
  openTrackMenu: [track: PluginSearchTrack, x: number, y: number];
  search: [keyword: string];
  selectProvider: [providerId: string];
  toggleFavorite: [track: Track];
  playTrack: [track: PluginSearchTrack];
}>();

const searchText = ref(props.query);
const { isScrolling: isResultListScrolling, showScrolling: showResultListScrolling } = useScrollingState();

const pluginTracks = computed<Track[]>(() => (
  props.results.map((track) => ({
    id: getPluginTrackId(track),
    path: `plugin://${track.providerId}/${encodeURIComponent(track.id)}`,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    artwork: track.artwork ?? null,
    sourceId: track.id,
    sourceName: track.providerName,
    sourceProviderId: track.providerId,
    sourceRaw: track.raw ?? track,
  }))
));
const pluginTrackByTrackId = computed(() => {
  return new Map(pluginTracks.value.map((track, index) => [track.id, props.results[index]]));
});
const activeTrack = computed(() => {
  return pluginTracks.value.find((track) => {
    const pluginTrack = pluginTrackByTrackId.value.get(track.id);
    return pluginTrack ? isActivePluginTrack(pluginTrack) : false;
  }) ?? null;
});
const preparingTrackId = computed(() => {
  if (!props.resolvingTrackKey) return null;
  return pluginTracks.value.find((track) => {
    const pluginTrack = pluginTrackByTrackId.value.get(track.id);
    return pluginTrack ? pluginSearchTrackKey(pluginTrack) === props.resolvingTrackKey : false;
  })?.id ?? null;
});
const providerTabItems = computed(() => (
  props.providers.length > 0
    ? props.providers.map((provider) => ({ id: provider.id, label: provider.name, disabled: !provider.enabled || props.loading }))
    : [{ id: '__empty__', label: '暂无插件', disabled: true }]
));

watch(
  () => props.query,
  (query) => {
    searchText.value = query;
  },
);

function isActivePluginTrack(track: PluginSearchTrack) {
  if (props.activeTrackKey && pluginSearchTrackKey(track) === props.activeTrackKey) return true;

  const active = props.activePlaybackTrack;
  if (!active) return false;

  if (active.sourceId && active.sourceId === track.id) {
    if (active.sourceProviderId && active.sourceProviderId === track.providerId) return true;
    if (active.sourceName && active.sourceName === track.providerName) return true;
  }

  return isDownloadedPluginTrack(track) && isSameTrackInfo(active, track);
}

function getPluginTrackId(track: PluginSearchTrack) {
  return pluginSearchTrackId(track);
}

function isDownloadedPluginTrack(track: PluginSearchTrack) {
  return props.downloadedTrackKeys.includes(`${track.providerName}:${track.id}`);
}

function isSameTrackInfo(active: Track, track: PluginSearchTrack) {
  if (normalizeTrackText(active.title) !== normalizeTrackText(track.title)) return false;
  if (normalizeTrackText(active.artist) !== normalizeTrackText(track.artist)) return false;
  if (active.duration == null || track.duration == null) return true;
  return Math.abs(active.duration - track.duration) <= 1;
}

function normalizeTrackText(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function submitSearch() {
  const keyword = searchText.value.trim();
  if (!keyword || props.loading) return;
  emit('search', keyword);
}

function selectProviderTab(providerId: string | null) {
  if (providerId && providerId !== '__empty__') emit('selectProvider', providerId);
}

function handleResultScroll(event: Event) {
  showResultListScrolling();

  const target = event.currentTarget as HTMLElement;
  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
  if (distanceToBottom <= 80 && props.hasMore && !props.loading && !props.loadingMore) {
    emit('loadMore');
  }
}

function playTableTrack(track: Track) {
  const pluginTrack = pluginTrackByTrackId.value.get(track.id);
  if (pluginTrack) emit('playTrack', pluginTrack);
}

function downloadTableTrack(track: Track) {
  const pluginTrack = pluginTrackByTrackId.value.get(track.id);
  if (pluginTrack) emit('downloadTrack', pluginTrack);
}

function openTableTrackMenu(track: Track, x: number, y: number) {
  const pluginTrack = pluginTrackByTrackId.value.get(track.id);
  if (pluginTrack) emit('openTrackMenu', pluginTrack, x, y);
}

</script>

<template>
  <section class="plugin-search-view">
    <div class="plugin-search-top">
      <header class="plugin-search-header">
        <SearchInput
          v-model="searchText"
          root-class="result-search"
          placeholder="搜索歌曲 / 歌手 / 专辑"
          :icon-size="20"
          show-enter-hint
          enter-hint="按 Enter 搜索"
          @submit="submitSearch"
        >
        </SearchInput>
      </header>

      <SegmentTabs label="插件来源" :items="providerTabItems" :model-value="activeProviderId" root-class="provider-tabs" @select="selectProviderTab" />

      <h1 class="result-title">搜索结果</h1>
    </div>

    <div class="plugin-result-list" :class="{ 'is-scrolling': isResultListScrolling }" @scroll="handleResultScroll">
      <LoadingState v-if="loading" message="正在搜索插件音源..." />

      <div v-else-if="pluginTracks.length > 0" class="plugin-result-body">
        <TrackTable
          label="Plugin search results"
          :tracks="pluginTracks"
          :active-track="activeTrack"
          :downloaded-track-keys="downloadedTrackKeys"
          :pending-download-track-keys="pendingDownloadTrackKeys"
          :preparing-track-id="preparingTrackId"
          :spectrum-levels="spectrumLevels"
          enable-download-action
          :favorite-track-ids="favoriteTrackIds"
          hide-action-header
          :is-playing="isPlaying"
          disable-internal-paging
          wide
          enable-context-menu
          @select-track="() => {}"
          @play-track="playTableTrack"
          @download-track="downloadTableTrack"
          @toggle-favorite="emit('toggleFavorite', $event)"
          @open-track-menu="openTableTrackMenu"
        />
        <p v-if="loadingMore" class="plugin-load-more-state">
          <SpinnerIcon :size="16" />
          正在加载更多...
        </p>
        <div v-else-if="loadMoreError" class="plugin-load-more-error">
          <span>{{ loadMoreError }}</span>
          <button class="secondary-button" type="button" @click="emit('retryLoadMore')">
            <RotateCcw :size="15" />
            重试
          </button>
        </div>
      </div>

      <EmptyState v-else :message="error ?? '没有搜索结果'">
        <template #action>
          <button class="secondary-button" type="button" @click="emit('retry')">
            <RotateCcw :size="15" />
            重新搜索
          </button>
        </template>
      </EmptyState>
    </div>
  </section>
</template>

<style scoped>
.plugin-search-view {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 22px 28px 24px;
  background: var(--smw-bg-workspace);
}

.plugin-search-top {
  display: grid;
  width: min(980px, 100%);
  gap: 18px;
  margin: 0 0 0 22px;
}

.plugin-search-header {
  display: block;
}

.result-title {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 20px;
  font-weight: 760;
}

.plugin-result-list {
  margin-top: 22px;
  min-height: 0;
  overflow: auto;
  scrollbar-color: transparent transparent;
}

.plugin-result-list.is-scrolling {
  scrollbar-color: var(--smw-scrollbar-thumb) transparent;
}

.plugin-result-list::-webkit-scrollbar {
  width: 10px;
}

.plugin-result-list::-webkit-scrollbar-thumb {
  background:
    linear-gradient(transparent, transparent)
    padding-box;
}

.plugin-result-list.is-scrolling::-webkit-scrollbar-thumb {
  background:
    linear-gradient(var(--smw-scrollbar-thumb), var(--smw-scrollbar-thumb))
    padding-box;
}

.plugin-result-list.is-scrolling::-webkit-scrollbar-thumb:hover {
  background:
    linear-gradient(var(--smw-scrollbar-thumb-hover), var(--smw-scrollbar-thumb-hover))
    padding-box;
}

.plugin-result-body {
  min-width: 0;
}

.plugin-load-more-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.plugin-load-more-error {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 46px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

@media (max-width: 980px) {
  .plugin-search-top {
    width: 100%;
    margin-left: 0;
  }
}
</style>
