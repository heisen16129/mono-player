<script setup lang="ts">
import { useTrackTableActiveRow } from '../composables/useTrackTableActiveRow';
import { useTrackTableInteractions } from '../composables/useTrackTableInteractions';
import { useTrackTableLabels } from '../composables/useTrackTableLabels';
import { useTrackTablePaging } from '../composables/useTrackTablePaging';
import { useTrackTableRowBindings } from '../composables/useTrackTableRowBindings';
import { useTrackTableRowState } from '../composables/useTrackTableRowState';
import { useTrackTableStyle } from '../composables/useTrackTableStyle';
import { useScrollingState } from '../composables/useScrollingState';
import { usePlayerStore } from '../stores/player';
import type {
  TrackTableEmits,
  TrackTableProps,
  TrackTableSlots,
} from '../types/trackTable';
import TrackTableHeader from './TrackTableHeader.vue';
import TrackTableRow from './TrackTableRow.vue';

const props = defineProps<TrackTableProps>();

defineSlots<TrackTableSlots>();

const emit = defineEmits<TrackTableEmits>();

const player = usePlayerStore();
const { isScrolling, showScrolling } = useScrollingState();
const { isActiveRow } = useTrackTableActiveRow({
  activeTrack: () => props.activeTrack,
  trackKey: () => props.trackKey,
});
const { trackTableStyle } = useTrackTableStyle({
  extraColumns: () => props.extraColumns,
  hideActionsColumn: () => props.hideActionsColumn,
});
const {
  albumLabel,
  artistLabel,
  localMusicLabel,
  titleLabel,
  toggleFavoriteLabel,
  unknownArtistLabel,
} = useTrackTableLabels({
  locale: () => player.settings.locale,
});
const {
  loadNextPage,
  scrollToTrack,
  setTrackRowRef,
  visibleTracks,
} = useTrackTablePaging({
  disableInternalPaging: () => props.disableInternalPaging,
  tracks: () => props.tracks,
});
const {
  canDownloadTrack,
  getDownloadActionLabel,
  isDownloadedTrack,
  isFavoriteTrack,
  isPendingDownloadTrack,
} = useTrackTableRowState({
  downloadedTrackKeys: () => props.downloadedTrackKeys,
  favoriteTrackIds: () => props.favoriteTrackIds,
  isFavoriteTrack: () => props.isFavoriteTrack ?? player.isFavorite,
  pendingDownloadTrackKeys: () => props.pendingDownloadTrackKeys,
});
const {
  handleTrackClick,
  handleTrackContextMenu,
  openTrackArtist,
} = useTrackTableInteractions({
  enableContextMenu: () => props.enableContextMenu,
  getLocale: () => player.settings.locale,
  onOpenArtist: (artistName) => emit('openArtist', artistName),
  onOpenTrackMenu: (track, x, y) => emit('openTrackMenu', track, x, y),
  onPlayTrack: (track) => emit('playTrack', track),
  onSelectTrack: (track) => emit('selectTrack', track),
});

const {
  getTrackTableRowProps,
  trackTableHeaderProps,
  trackTableRowListeners,
} = useTrackTableRowBindings({
  albumLabel,
  artistLabel,
  canDownloadTrack,
  emit,
  getDownloadActionLabel,
  handleTrackClick,
  handleTrackContextMenu,
  isActiveRow,
  isDownloadedTrack,
  isFavoriteTrack,
  isPendingDownloadTrack,
  localMusicLabel,
  openTrackArtist,
  props,
  setTrackRowRef,
  showTrackCovers: () => player.settings.showTrackCovers,
  showTrackNumbers: () => player.settings.showTrackNumbers,
  titleLabel,
  toggleFavoriteLabel,
  unknownArtistLabel,
});

defineExpose({
  loadNextPage,
  scrollToTrack,
});

</script>

<template>
  <section
    class="track-table"
    :class="{
      'track-table-wide': wide,
      'track-table-recent': recent,
      'track-table-number-column': player.settings.showTrackNumbers,
      'track-table-cover-column': player.settings.showTrackCovers,
      'track-table-has-extra': Boolean(extraColumns),
      'track-table-hide-actions': hideActionsColumn,
      'track-table-scrollable': scrollable,
      'transient-scrollbar': scrollable,
      'is-scrolling': scrollable && isScrolling,
      [`track-table-highlight-${highlightClass}`]: Boolean(highlightClass),
    }"
    :style="trackTableStyle"
    :aria-label="label"
    @scroll="scrollable && showScrolling()"
  >
    <TrackTableHeader
      v-bind="trackTableHeaderProps"
    >
      <template #extraHead>
        <slot name="extraHead"></slot>
      </template>
    </TrackTableHeader>

    <TrackTableRow
      v-for="(track, index) in visibleTracks"
      :key="track.id"
      v-bind="{ ...getTrackTableRowProps(track, index), ...trackTableRowListeners }"
    >
      <template #extraCells="{ track: slotTrack, index: slotIndex }">
        <slot name="extraCells" :track="slotTrack" :index="slotIndex"></slot>
      </template>
    </TrackTableRow>
  </section>
</template>

<style scoped>
.track-table {
  display: grid;
  align-content: start;
  padding: 0;
}

.track-table-scrollable {
  min-height: 0;
  overflow: auto;
}

.track-table-wide {
  padding: 0 8px 24px;
}

.track-head,
.track-row {
  display: grid;
  grid-template-columns: minmax(150px, 1.35fr) minmax(96px, 0.85fr) minmax(108px, 0.9fr) 76px 52px;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  text-align: left;
}

.track-table-number-column .track-head,
.track-table-number-column .track-row {
  grid-template-columns: 42px minmax(150px, 1.35fr) minmax(96px, 0.85fr) minmax(108px, 0.9fr) 76px 52px;
}

.track-table-wide .track-head,
.track-table-wide .track-row {
  grid-template-columns: minmax(170px, 1.25fr) minmax(104px, 0.85fr) minmax(112px, 0.9fr) 78px 54px;
  min-height: 44px;
  padding: 0 12px;
}

.track-table-wide.track-table-number-column .track-head,
.track-table-wide.track-table-number-column .track-row {
  grid-template-columns: 46px minmax(170px, 1.25fr) minmax(104px, 0.85fr) minmax(112px, 0.9fr) 78px 54px;
}

.track-table-has-extra .track-head,
.track-table-has-extra .track-row {
  grid-template-columns: minmax(150px, 1.35fr) minmax(96px, 0.85fr) minmax(108px, 0.9fr) 76px var(--track-extra-columns) var(--track-actions-column);
}

.track-table-has-extra.track-table-number-column .track-head,
.track-table-has-extra.track-table-number-column .track-row {
  grid-template-columns: 42px minmax(150px, 1.35fr) minmax(96px, 0.85fr) minmax(108px, 0.9fr) 76px var(--track-extra-columns) var(--track-actions-column);
}

.track-table-wide.track-table-has-extra .track-head,
.track-table-wide.track-table-has-extra .track-row {
  grid-template-columns: minmax(170px, 1.25fr) minmax(104px, 0.85fr) minmax(112px, 0.9fr) 78px var(--track-extra-columns) var(--track-actions-column);
}

.track-table-wide.track-table-has-extra.track-table-number-column .track-head,
.track-table-wide.track-table-has-extra.track-table-number-column .track-row {
  grid-template-columns: 46px minmax(170px, 1.25fr) minmax(104px, 0.85fr) minmax(112px, 0.9fr) 78px var(--track-extra-columns) var(--track-actions-column);
}

.track-table-wide .track-head {
  border-radius: 0;
  color: var(--smw-text-primary);
  font-weight: 620;
}

.track-table-wide .track-row:hover {
  background: color-mix(in srgb, var(--smw-bg-hover) 72%, transparent);
  box-shadow: none;
}

.track-table-wide .track-row.selected,
.track-table-wide .track-row.selected:hover {
  background: var(--smw-bg-selected);
  box-shadow: inset 0 0 0 1px var(--smw-border);
}

.track-table-recent .track-row.selected {
  background: var(--smw-bg-selected);
  box-shadow: inset 0 0 0 1px var(--smw-border);
}

.track-table-recent .track-row.selected:hover {
  background: var(--smw-bg-selected);
}

.track-table-highlight-is-context-open .track-row.is-context-open {
  background: var(--smw-bg-selected);
}

.track-table :deep(.track-row > span:not(.track-title)) {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-table :deep(.track-row > .track-artist-link) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  max-width: 100%;
  color: var(--smw-text-secondary);
  cursor: pointer;
  text-decoration: none;
}

.track-table :deep(.track-row > .track-artist-link:hover) {
  color: var(--smw-button-primary);
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--smw-button-primary) 64%, transparent);
  text-underline-offset: 4px;
}

.track-table :deep(.track-row > .track-artist-link:focus-visible) {
  border-radius: 4px;
  outline: 2px solid color-mix(in srgb, var(--smw-button-primary) 42%, transparent);
  outline-offset: 3px;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--smw-button-primary) 64%, transparent);
  text-underline-offset: 4px;
}

.track-table :deep(.track-row > .track-actions) {
  color: var(--smw-text-secondary);
}

.track-table :deep(.track-row > span:last-child),
.track-table :deep(.track-head > span:last-child) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-table :deep(.track-title) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-table :deep(.track-title-text) {
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-table-cover-column .track-row {
  min-height: 44px;
}

.track-table-cover-column :deep(.track-title) {
  gap: 8px;
}

@media (max-width: 1100px) {
  .track-head,
  .track-row {
    grid-template-columns: minmax(160px, 1.3fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr) 72px 38px;
  }

  .track-table-number-column .track-head,
  .track-table-number-column .track-row {
    grid-template-columns: 38px minmax(160px, 1.3fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr) 72px 38px;
  }

  .track-table-has-extra .track-head,
  .track-table-has-extra .track-row {
    grid-template-columns: minmax(160px, 1.3fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr) 72px var(--track-extra-columns) var(--track-actions-column);
  }

  .track-table-has-extra.track-table-number-column .track-head,
  .track-table-has-extra.track-table-number-column .track-row {
    grid-template-columns: 38px minmax(160px, 1.3fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr) 72px var(--track-extra-columns) var(--track-actions-column);
  }

}

@media (max-width: 820px) {
  .track-head,
  .track-row {
    grid-template-columns: minmax(150px, 1fr) 70px;
  }

  .track-table-number-column .track-head,
  .track-table-number-column .track-row {
    grid-template-columns: 34px minmax(150px, 1fr) 70px;
  }

  .track-table-has-extra .track-head,
  .track-table-has-extra .track-row {
    grid-template-columns: minmax(150px, 1fr) 70px var(--track-extra-columns) var(--track-actions-column);
  }

  .track-table-has-extra.track-table-number-column .track-head,
  .track-table-has-extra.track-table-number-column .track-row {
    grid-template-columns: 34px minmax(150px, 1fr) 70px var(--track-extra-columns) var(--track-actions-column);
  }

  .track-table :deep(.track-head span:nth-child(3)),
  .track-table :deep(.track-head span:nth-child(4)),
  .track-table :deep(.track-head span:nth-child(6)),
  .track-table :deep(.track-row span:nth-child(3)),
  .track-table :deep(.track-row span:nth-child(4)),
  .track-table :deep(.track-row span:nth-child(6)) {
    display: none;
  }
}
</style>
