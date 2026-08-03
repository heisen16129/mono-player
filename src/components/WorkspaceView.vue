<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { t } from '../i18n';
import { useWorkspaceCollectionDisplay } from '../composables/useWorkspaceCollectionDisplay';
import { usePlayerStore } from '../stores/player';
import type { WorkspaceTrackListListeners, WorkspaceTrackListProps, WorkspaceViewEmits, WorkspaceViewProps } from '../types/workspace';
import CollectionHero from './CollectionHero.vue';
import WorkspaceSearchToolbar from './WorkspaceSearchToolbar.vue';
import WorkspaceTrackList from './WorkspaceTrackList.vue';

const props = defineProps<WorkspaceViewProps>();

const emit = defineEmits<WorkspaceViewEmits>();

const trackListRef = ref<InstanceType<typeof WorkspaceTrackList> | null>(null);
const player = usePlayerStore();

const locale = computed(() => player.settings.locale);
const {
  canLocateActiveTrack,
  collectionDate,
  collectionEmptyText,
  collectionHeroId,
  collectionSubtitle,
  collectionTitle,
  hasPlayableVisibleTracks,
  isWideCollection,
} = useWorkspaceCollectionDisplay({
  activeCollection: toRef(props, 'activeCollection'),
  activeTrack: toRef(props, 'activeTrack'),
  isPlaylistView: toRef(props, 'isPlaylistView'),
  libraryFilter: toRef(props, 'libraryFilter'),
  libraryMeta: toRef(props, 'libraryMeta'),
  libraryTitle: toRef(props, 'libraryTitle'),
  locale,
  tracks: toRef(props, 'tracks'),
});

const workspaceTrackListProps = computed<WorkspaceTrackListProps>(() => ({
  activeTrack: props.activeTrack,
  emptyMessage: collectionEmptyText.value,
  error: props.error,
  favoriteTrackIds: props.favoriteTrackIds,
  isPlaying: props.isPlaying,
  isWideCollection: isWideCollection.value,
  preparingTrackId: props.preparingTrackId ?? null,
  spectrumLevels: props.spectrumLevels,
  tracks: props.tracks,
}));

const workspaceTrackListListeners: WorkspaceTrackListListeners = {
  onOpenArtist: (...args) => emit('openArtist', ...args),
  onOpenTrackMenu: (...args) => emit('openTrackMenu', ...args),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onSelectTrack: (...args) => emit('selectTrack', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};

function playAllVisibleTracks() {
  if (props.activeCollection === 'favorites') {
    emit('playFavoriteTracks');
    return;
  }

  emit('playVisibleTracks');
}

async function locateActiveTrack() {
  const activeTrackId = props.activeTrack?.id;
  if (!activeTrackId) return;

  await trackListRef.value?.scrollToTrack(activeTrackId);
}
</script>

<template>
  <section class="workspace" :class="{ 'favorites-workspace': isWideCollection }">
    <WorkspaceSearchToolbar
      :model-value="modelValue"
      :placeholder="t(player.settings.locale, 'searchPlaceholder')"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <CollectionHero
      :id="collectionHeroId"
      :tracks="tracks"
      :title="collectionTitle"
      :subtitle="collectionSubtitle"
      :date="collectionDate"
      :play-label="t(player.settings.locale, 'playAll')"
      :locate-label="t(player.settings.locale, 'locateCurrentTrack')"
      :can-play="hasPlayableVisibleTracks"
      :can-locate="canLocateActiveTrack"
      @play="playAllVisibleTracks"
      @locate="locateActiveTrack"
    />

    <WorkspaceTrackList
      ref="trackListRef"
      v-bind="{ ...workspaceTrackListProps, ...workspaceTrackListListeners }"
    />
  </section>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 12px 22px 24px;
  background: var(--smw-bg-workspace);
}

@media (max-height: 760px) and (min-width: 821px) {
  .workspace {
    padding-top: 10px;
    padding-bottom: 18px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .workspace {
    padding-top: 8px;
    padding-bottom: 14px;
  }
}
</style>
