<script setup lang="ts">
import { Loader2, RotateCcw, Search } from '@lucide/vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
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
const isResultListScrolling = ref(false);
let resultListScrollTimer: number | undefined;

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
    return pluginTrack ? getTrackKey(pluginTrack) === props.resolvingTrackKey : false;
  })?.id ?? null;
});

watch(
  () => props.query,
  (query) => {
    searchText.value = query;
  },
);

function getTrackKey(track: PluginSearchTrack) {
  return `${track.providerId}:${track.id}`;
}

function isActivePluginTrack(track: PluginSearchTrack) {
  if (props.activeTrackKey && getTrackKey(track) === props.activeTrackKey) return true;

  const active = props.activePlaybackTrack;
  if (!active) return false;

  if (active.sourceId && active.sourceId === track.id) {
    if (active.sourceProviderId && active.sourceProviderId === track.providerId) return true;
    if (active.sourceName && active.sourceName === track.providerName) return true;
  }

  return isDownloadedPluginTrack(track) && isSameTrackInfo(active, track);
}

function getPluginTrackId(track: PluginSearchTrack) {
  return -Math.abs(hashPluginTrackId(getTrackKey(track)));
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

function hashPluginTrackId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return hash || 1;
}

function submitSearch() {
  const keyword = searchText.value.trim();
  if (!keyword || props.loading) return;
  emit('search', keyword);
}

function handleResultScroll(event: Event) {
  isResultListScrolling.value = true;
  window.clearTimeout(resultListScrollTimer);
  resultListScrollTimer = window.setTimeout(() => {
    isResultListScrolling.value = false;
  }, 800);

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

onBeforeUnmount(() => {
  window.clearTimeout(resultListScrollTimer);
});
</script>

<template>
  <section class="plugin-search-view">
    <div class="plugin-search-top">
      <header class="plugin-search-header">
        <form class="result-search" @submit.prevent="submitSearch">
          <Search :size="20" />
          <input v-model="searchText" type="search" placeholder="搜索歌曲 / 歌手 / 专辑" />
          <span class="enter-hint"><kbd>Enter</kbd><span>按 Enter 搜索</span></span>
        </form>
      </header>

      <nav class="provider-tabs" aria-label="插件来源">
        <button
          v-for="provider in providers"
          :key="provider.id"
          class="provider-pill"
          :class="{ active: activeProviderId === provider.id, disabled: !provider.enabled }"
          type="button"
          :disabled="!provider.enabled || loading"
          @click="emit('selectProvider', provider.id)"
        >
          {{ provider.name }}
        </button>
        <span v-if="providers.length === 0" class="provider-pill disabled">暂无插件</span>
      </nav>

      <h1 class="result-title">搜索结果</h1>
    </div>

    <div class="plugin-result-list" :class="{ 'is-scrolling': isResultListScrolling }" @scroll="handleResultScroll">
      <p v-if="loading" class="plugin-search-state">
        <Loader2 class="spinning" :size="18" />
        正在搜索插件音源...
      </p>

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
          <Loader2 class="spinning" :size="16" />
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

      <div v-else class="plugin-search-empty">
        <p>{{ error ?? '没有搜索结果' }}</p>
        <button class="secondary-button" type="button" @click="emit('retry')">
          <RotateCcw :size="15" />
          重新搜索
        </button>
      </div>
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

.result-search {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  width: min(320px, 34vw);
  height: 42px;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
}

.result-search svg {
  color: var(--smw-icon-muted);
}

.result-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  box-shadow: none;
  color: var(--smw-text-primary);
  background: transparent;
  font: inherit;
  font-size: 14px;
}

.result-search input:focus,
.result-search input:focus-visible {
  box-shadow: none;
}

.result-search input::placeholder {
  color: var(--smw-text-muted);
}

.enter-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.enter-hint kbd {
  display: inline-grid;
  min-width: 42px;
  height: 22px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  font-family: inherit;
  font-size: 11px;
  font-weight: 520;
}

.provider-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  padding: 0;
}

.provider-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.provider-pill.active {
  border-color: transparent;
  color: #fff;
  background: var(--smw-button-primary);
}

.provider-pill.disabled {
  color: var(--smw-text-secondary);
  cursor: default;
  opacity: 0.68;
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

.plugin-search-state,
.plugin-search-empty {
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 220px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
  text-align: center;
}

.plugin-search-empty p {
  max-width: 540px;
  margin: 0;
  line-height: 1.6;
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.spinning {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .plugin-search-top {
    width: 100%;
    margin-left: 0;
  }

  .enter-hint span {
    display: none;
  }

  .result-search {
    width: min(320px, 100%);
  }
}
</style>
