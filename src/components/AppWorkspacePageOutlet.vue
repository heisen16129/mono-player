<script setup lang="ts">
import { computed } from 'vue';
import WorkspaceView from './WorkspaceView.vue';
import type { AppWorkspacePageOutletEmits, AppWorkspacePageOutletProps } from '../types/appPageOutlet';
import type { WorkspaceViewListeners, WorkspaceViewProps } from '../types/workspace';

const props = defineProps<AppWorkspacePageOutletProps>();

const emit = defineEmits<AppWorkspacePageOutletEmits>();

const workspaceViewProps = computed<WorkspaceViewProps>(() => ({
  activeCollection: props.activeCollection,
  activePlaylistId: props.activePlaylistId,
  activeTrack: props.activeTrack,
  error: props.error,
  favoriteTrackIds: props.favoriteTrackIds,
  isPlaying: props.isPlaying,
  isPlaylistView: Boolean(props.activePlaylistId),
  libraryFilter: props.libraryFilter,
  libraryMeta: props.libraryMeta,
  libraryTitle: props.libraryTitle,
  modelValue: props.modelValue,
  preparingTrackId: props.isPreparingActiveTrack ? props.activeTrack?.id ?? null : null,
  tracks: props.tracks,
}));

const workspaceViewListeners: WorkspaceViewListeners = {
  'onUpdate:modelValue': (...args) => emit('update:modelValue', ...args),
  onChangePlaylistCover: (...args) => emit('changePlaylistCover', ...args),
  onOpenArtist: (...args) => emit('openArtist', ...args),
  onOpenTrackMenu: (...args) => emit('openTrackMenu', ...args),
  onPlayFavoriteTracks: () => emit('playFavoriteTracks'),
  onPlayVisibleTracks: () => emit('playFavoriteTracks'),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onSelectTrack: (...args) => emit('selectTrack', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};
</script>

<template>
  <WorkspaceView
    v-bind="{ ...workspaceViewProps, ...workspaceViewListeners }"
  />
</template>


