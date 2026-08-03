<script setup lang="ts">
import type { SegmentTabItem } from '../SegmentTabs.vue';
import type { PluginSearchTrack } from '../../types/plugin';
import LyricsSearchDialog from './LyricsSearchDialog.vue';

defineProps<{
  isLoadingMore: boolean;
  isOpen: boolean;
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

defineEmits<{
  apply: [track: PluginSearchTrack];
  close: [];
  scroll: [event: Event];
  search: [];
  selectProvider: [id: string | null];
  'update:query': [value: string];
}>();
</script>

<template>
  <Teleport to="body">
    <LyricsSearchDialog
      v-if="isOpen"
      :query="query"
      :is-loading-more="isLoadingMore"
      :is-searching="isSearching"
      :provider-id="providerId"
      :providers="providers"
      :resolving-track-key="resolvingTrackKey"
      :results="results"
      :status="status"
      :tab-items="tabItems"
      :track-key="trackKey"
      @apply="$emit('apply', $event)"
      @close="$emit('close')"
      @scroll="$emit('scroll', $event)"
      @search="$emit('search')"
      @select-provider="$emit('selectProvider', $event)"
      @update:query="$emit('update:query', $event)"
    />
  </Teleport>
</template>
