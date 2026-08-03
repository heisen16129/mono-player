<script setup lang="ts">
import DiscoverMusicPage from './DiscoverMusicPage.vue';
import type { AppDiscoverPageOutletEmits, AppDiscoverPageOutletProps, DiscoverMusicPageListeners } from '../types/appPageOutlet';

const props = defineProps<AppDiscoverPageOutletProps>();

const emit = defineEmits<AppDiscoverPageOutletEmits>();

const discoverMusicPageListeners: DiscoverMusicPageListeners = {
  onBackLocal: () => emit('backLocal'),
  onDownloadTrack: (...args) => emit('downloadTrack', ...args),
  onNotify: (...args) => emit('notify', ...args),
  onOpenTrackMenu: (...args) => emit('openTrackMenu', ...args),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onSearchReady: (...args) => emit('searchReady', ...args),
  onSearchStarted: () => emit('searchStarted'),
  onSearchUpdated: (...args) => emit('searchUpdated', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};
</script>

<template>
  <DiscoverMusicPage
    v-bind="{ ...props, ...discoverMusicPageListeners }"
  />
</template>


