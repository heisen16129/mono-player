<script setup lang="ts">
import { Music } from '@lucide/vue';
import BaseDialog from '../BaseDialog.vue';
import SearchInput from '../SearchInput.vue';
import SegmentTabs, { type SegmentTabItem } from '../SegmentTabs.vue';
import type { PluginSearchTrack } from '../../types/plugin';
import { artworkDisplaySrc } from '../../utils/artwork';

defineProps<{
  isLoadingMore: boolean;
  isSearching: boolean;
  providerId: string | null;
  providers: unknown[];
  query: string;
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  status: string;
  tabItems: SegmentTabItem[];
  trackKey: (track: PluginSearchTrack) => string;
}>();

const emit = defineEmits<{
  apply: [track: PluginSearchTrack];
  close: [];
  scroll: [event: Event];
  search: [];
  selectProvider: [id: string | null];
  'update:query': [value: string];
}>();
</script>

<template>
  <BaseDialog
    label="搜索歌词"
    close-label="关闭"
    close-on-overlay
    grid-template-rows="auto auto minmax(0, 1fr)"
    max-height="min(520px, calc(100vh - 80px))"
    overflow="hidden"
    panel-class="lyrics-search-dialog"
    width="min(560px, calc(100vw - 32px))"
    :z-index="240"
    @close="emit('close')"
  >
    <template #header>
      <SearchInput
        :model-value="query"
        root-class="lyrics-search-field"
        placeholder="搜索歌词"
        @update:model-value="emit('update:query', $event)"
        @submit="emit('search')"
      />
    </template>

    <SegmentTabs
      v-if="providers.length > 0"
      label="歌词来源"
      :items="tabItems"
      :model-value="providerId"
      root-class="lyrics-provider-tabs"
      @select="emit('selectProvider', $event)"
    />

    <div class="lyrics-search-results" @scroll="emit('scroll', $event)">
      <p v-if="isSearching" class="lyrics-search-state">正在搜索歌词...</p>
      <template v-else>
        <button
          v-for="track in results"
          :key="trackKey(track)"
          class="lyrics-search-row"
          type="button"
          :disabled="resolvingTrackKey === trackKey(track)"
          @click="emit('apply', track)"
        >
          <span class="lyrics-search-cover">
            <img v-if="track.artwork" :src="artworkDisplaySrc(track.artwork)" alt="" />
            <Music v-else :size="20" :stroke-width="2.4" />
          </span>
          <span class="lyrics-search-meta">
            <strong>{{ track.title }}</strong>
            <small>{{ track.artist || '未知歌手' }} · {{ track.providerName }}</small>
          </span>
          <small v-if="resolvingTrackKey === trackKey(track)" class="lyrics-search-resolving">读取中</small>
        </button>
        <p v-if="isLoadingMore" class="lyrics-search-state">正在加载更多...</p>
      </template>
      <p v-if="!isSearching && status" class="lyrics-search-state">{{ status }}</p>
    </div>
  </BaseDialog>
</template>

<style scoped>
.lyrics-search-results {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 12px 12px;
}

.lyrics-search-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.lyrics-search-row:hover,
.lyrics-search-row:focus-visible {
  background: var(--smw-bg-hover);
  outline: none;
}

.lyrics-search-row:disabled {
  cursor: wait;
  opacity: 0.72;
}

.lyrics-search-cover {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  overflow: hidden;
  border-radius: 7px;
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
}

.lyrics-search-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lyrics-search-meta {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.lyrics-search-meta strong,
.lyrics-search-meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-search-meta strong {
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 520;
}

.lyrics-search-meta small,
.lyrics-search-resolving,
.lyrics-search-state {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.lyrics-search-state {
  margin: 18px 8px;
  text-align: center;
}
</style>
