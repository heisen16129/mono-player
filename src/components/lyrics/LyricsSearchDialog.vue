<script setup lang="ts">
import BaseDialog from '../BaseDialog.vue';
import type { SegmentTabItem } from '../SegmentTabs.vue';
import type { PluginSearchTrack } from '../../types/plugin';
import LyricsProviderTabs from './LyricsProviderTabs.vue';
import LyricsSearchInput from './LyricsSearchInput.vue';
import LyricsSearchResultsList from './LyricsSearchResultsList.vue';

defineProps<{
  label?: string;
  zIndex?: number;
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
    :label="label || '搜索歌词'"
    close-label="关闭"
    close-on-overlay
    grid-template-rows="auto auto minmax(0, 1fr)"
    header-padding="10px 12px"
    max-height="min(520px, calc(100vh - 80px))"
    overflow="hidden"
    panel-class="lyrics-search-dialog"
    width="min(660px, calc(100vw - 32px))"
    :z-index="zIndex || 240"
    @close="emit('close')"
  >
    <template #header>
      <LyricsSearchInput
        :model-value="query"
        :placeholder="label || '搜索歌词'"
        @update:model-value="emit('update:query', $event)"
        @submit="emit('search')"
      />
    </template>

    <LyricsProviderTabs
      v-if="providers.length > 0"
      :label="label === '搜索封面' ? '封面来源' : '歌词来源'"
      :items="tabItems"
      :model-value="providerId"
      @select="emit('selectProvider', $event)"
    />

    <LyricsSearchResultsList
      :searching-text="label === '搜索封面' ? '正在搜索封面...' : undefined"
      :is-loading-more="isLoadingMore"
      :is-searching="isSearching"
      :resolving-track-key="resolvingTrackKey"
      :results="results"
      :status="status"
      :track-key="trackKey"
      @apply="emit('apply', $event)"
      @scroll="emit('scroll', $event)"
    />
  </BaseDialog>
</template>
