<script setup lang="ts">
import { computed } from 'vue';
import LibraryContentLayout from './LibraryContentLayout.vue';
import LibraryPanel from './LibraryPanel.vue';
import WorkspaceView from './WorkspaceView.vue';
import type { LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { LibraryPanelListeners, LibraryPanelProps, LocalFolderItem } from '../types/library';
import type { Track } from '../types/music';
import type { WorkspaceViewListeners, WorkspaceViewProps } from '../types/workspace';

const props = defineProps<{
  activeCollection: LibraryCollection;
  activeFolderPath: string | null;
  activeLibraryFilter: LibraryFilter;
  activePlaylistId: string | null;
  activeTrack: Track | null;
  favoriteTrackIds: number[];
  isAudioPlaying: boolean;
  isOnlineSearchOpen: boolean;
  isPreparingActiveTrack: boolean;
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  localFolderTrackCount: number;
  localFolders: LocalFolderItem[];
  playbackSpectrumLevels: number[];
  playerError: string | null;
  playerQuery: string;
  recentAddedTrackCount: number;
  visibleTracks: Track[];
}>();

const emit = defineEmits<{
  chooseFolder: [];
  openArtistFromTrack: [artistName: string];
  openLocalFolderFromPanel: [path: string];
  openRecentAddedFromPanel: [];
  openScanDialog: [];
  openTrackContextMenu: [track: Track, x: number, y: number];
  playFavoriteTracks: [];
  playTrack: [track: Track];
  rescanLibrary: [];
  returnToLocalLibrary: [];
  selectTrack: [track: Track];
  toggleFavoriteForTrack: [track: Track];
  updatePlayerQuery: [value: string];
}>();

const libraryPanelProps = computed<LibraryPanelProps>(() => ({
  activeCollection: props.activeCollection,
  activeFolderPath: props.activeFolderPath,
  activeLibraryFilter: props.activeLibraryFilter,
  activeOnlineSearch: props.isOnlineSearchOpen,
  localFolders: props.localFolders,
  recentAddedCount: props.recentAddedTrackCount,
  visibleTrackCount: props.localFolderTrackCount,
}));

const libraryPanelListeners: LibraryPanelListeners = {
  onChooseFolder: () => emit('chooseFolder'),
  onOpenAll: () => emit('returnToLocalLibrary'),
  onOpenFolder: (path) => emit('openLocalFolderFromPanel', path),
  onOpenRecentAdded: () => emit('openRecentAddedFromPanel'),
  onOpenScanDialog: () => emit('openScanDialog'),
};

const workspaceViewProps = computed<WorkspaceViewProps>(() => ({
  activeCollection: props.activeCollection,
  activeTrack: props.activeTrack,
  error: props.playerError,
  favoriteTrackIds: props.favoriteTrackIds,
  isPlaying: props.isAudioPlaying,
  isPlaylistView: Boolean(props.activePlaylistId),
  libraryFilter: props.activeLibraryFilter,
  libraryMeta: props.libraryMeta,
  libraryTitle: props.libraryTitle,
  modelValue: props.playerQuery,
  preparingTrackId: props.isPreparingActiveTrack ? props.activeTrack?.id ?? null : null,
  spectrumLevels: props.playbackSpectrumLevels,
  tracks: props.visibleTracks,
}));

const workspaceViewListeners: WorkspaceViewListeners = {
  'onUpdate:modelValue': (value) => emit('updatePlayerQuery', value),
  onOpenArtist: (artistName) => emit('openArtistFromTrack', artistName),
  onOpenTrackMenu: (track, x, y) => emit('openTrackContextMenu', track, x, y),
  onPlayFavoriteTracks: () => emit('playFavoriteTracks'),
  onPlayVisibleTracks: () => emit('playFavoriteTracks'),
  onPlayTrack: (track) => emit('playTrack', track),
  onSelectTrack: (track) => emit('selectTrack', track),
  onToggleFavorite: (track) => emit('toggleFavoriteForTrack', track),
};
</script>

<template>
  <LibraryContentLayout>
    <template #panel>
      <LibraryPanel
        v-bind="{ ...libraryPanelProps, ...libraryPanelListeners }"
      />
    </template>
    <template #detail>
      <WorkspaceView
        v-bind="{ ...workspaceViewProps, ...workspaceViewListeners }"
      />
    </template>
  </LibraryContentLayout>
</template>


