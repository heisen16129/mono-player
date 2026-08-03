<script setup lang="ts">
import ArtistsView from './ArtistsView.vue';
import type { AppArtistsPageOutletEmits, AppArtistsPageOutletProps, ArtistsViewListeners } from '../types/appPageOutlet';

const props = defineProps<AppArtistsPageOutletProps>();

const emit = defineEmits<AppArtistsPageOutletEmits>();

const artistsViewListeners: ArtistsViewListeners = {
  'onUpdate:modelValue': (...args) => emit('update:modelValue', ...args),
  onOpenTrackMenu: (...args) => emit('openTrackMenu', ...args),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onSelectArtist: (...args) => emit('selectArtist', ...args),
  onSelectTrack: (...args) => emit('selectTrack', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};
</script>

<template>
  <ArtistsView
    v-bind="{ ...props, ...artistsViewListeners }"
  />
</template>


