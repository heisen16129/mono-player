<script setup lang="ts">
import { computed } from 'vue';
import type {
  TrackRowActionsListeners,
  TrackRowActionsProps,
  TrackTableRowEmits,
  TrackTableRowProps,
  TrackTableRowSlots,
} from '../types/trackTable';
import TrackAlbumCell from './TrackAlbumCell.vue';
import TrackArtistCell from './TrackArtistCell.vue';
import TrackDurationCell from './TrackDurationCell.vue';
import TrackIndexCell from './TrackIndexCell.vue';
import TrackRowActions from './TrackRowActions.vue';
import TrackTitleCell from './TrackTitleCell.vue';
import { artistNames } from '../utils/artist';

const props = defineProps<TrackTableRowProps>();

defineSlots<TrackTableRowSlots>();

const emit = defineEmits<TrackTableRowEmits>();

const trackRowActionsProps = computed<TrackRowActionsProps>(() => ({
  canDownload: props.canDownload,
  downloadActionLabel: props.downloadActionLabel,
  enableDownloadAction: props.enableDownloadAction,
  isDownloaded: props.isDownloaded,
  isFavorite: props.isFavorite,
  isPendingDownload: props.isPendingDownload,
  showFavoriteAction: props.showFavoriteAction,
  toggleFavoriteLabel: props.toggleFavoriteLabel,
  track: props.track,
}));

const trackRowActionsListeners: TrackRowActionsListeners = {
  onDownloadTrack: (...args) => emit('downloadTrack', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};

const displayArtistNames = computed(() => {
  const names = artistNames(props.track.artist);
  return names.length > 0 ? names : [props.unknownArtistLabel];
});
</script>

<template>
  <button
    :ref="setRowRef"
    class="track-row"
    :class="[
      { selected: active, preparing },
      rowClass?.(track),
    ]"
    type="button"
    @click="$emit('click', $event, track)"
    @contextmenu="$emit('contextMenu', $event, track)"
  >
    <TrackIndexCell v-if="showTrackNumbers" :index="index" />
    <TrackTitleCell
      :active="active"
      :loading="preparing && active"
      :playing="isPlaying && active"
      :show-cover="showTrackCovers"
      :track="track"
    />
    <TrackArtistCell :artist-names="displayArtistNames" :enable-link="enableArtistLinks" @open-artist="$emit('openArtist', $event)" />
    <TrackAlbumCell :album="track.album" :fallback="localMusicLabel" />
    <TrackDurationCell :duration="track.duration" />
    <span v-if="extraColumns" class="track-extra-cells">
      <slot name="extraCells" :track="track" :index="index"></slot>
    </span>
    <TrackRowActions
      v-if="!hideActionsColumn"
      v-bind="{ ...trackRowActionsProps, ...trackRowActionsListeners }"
    />
  </button>
</template>

<style scoped>
.track-row {
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  outline: none;
}

.track-row:hover,
.track-row.selected {
  background: var(--smw-bg-selected);
  box-shadow: inset 0 0 0 1px var(--smw-border);
}

.track-row.preparing {
  background: color-mix(in srgb, var(--smw-bg-selected) 84%, transparent);
}

.track-extra-cells {
  display: contents;
}

.track-extra-cells :slotted(*) {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 820px) {
  .track-row span:nth-child(3),
  .track-row span:nth-child(4),
  .track-row span:nth-child(6) {
    display: none;
  }
}
</style>


