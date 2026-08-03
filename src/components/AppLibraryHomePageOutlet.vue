<script setup lang="ts">
import LibraryHomePage from './LibraryHomePage.vue';
import type { AppLibraryHomePageOutletEmits, AppLibraryHomePageOutletProps, LibraryHomePageListeners } from '../types/appPageOutlet';

const props = defineProps<AppLibraryHomePageOutletProps>();

const emit = defineEmits<AppLibraryHomePageOutletEmits>();

const libraryHomePageListeners: LibraryHomePageListeners = {
  onChooseFolder: () => emit('chooseFolder'),
  onOpenArtistFromTrack: (...args) => emit('openArtistFromTrack', ...args),
  onOpenLocalFolderFromPanel: (...args) => emit('openLocalFolderFromPanel', ...args),
  onOpenRecentAddedFromPanel: () => emit('openRecentAddedFromPanel'),
  onOpenScanDialog: () => emit('openScanDialog'),
  onOpenTrackContextMenu: (...args) => emit('openTrackContextMenu', ...args),
  onPlayFavoriteTracks: () => emit('playFavoriteTracks'),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onRescanLibrary: () => emit('rescanLibrary'),
  onReturnToLocalLibrary: () => emit('returnToLocalLibrary'),
  onSelectTrack: (...args) => emit('selectTrack', ...args),
  onToggleFavoriteForTrack: (...args) => emit('toggleFavoriteForTrack', ...args),
  onUpdatePlayerQuery: (...args) => emit('updatePlayerQuery', ...args),
};
</script>

<template>
  <LibraryHomePage
    v-bind="{ ...props, ...libraryHomePageListeners }"
  />
</template>


