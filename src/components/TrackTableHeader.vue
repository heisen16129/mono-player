<script setup lang="ts">
import { Clock3 } from '@lucide/vue';
import type { TrackTableHeaderProps, TrackTableHeaderSlots } from '../types/trackTable';
import TrackTableActionsHeader from './TrackTableActionsHeader.vue';

defineProps<TrackTableHeaderProps>();

defineSlots<TrackTableHeaderSlots>();
</script>

<template>
  <div class="track-head" :class="{ 'has-number-column': showTrackNumbers }">
    <span v-if="showTrackNumbers">#</span>
    <span class="track-title">
      <span v-if="showTrackCovers" class="track-cover-head"></span>
      {{ titleLabel }}
    </span>
    <span class="track-artist-head">{{ artistLabel }}</span>
    <span class="track-album-head">{{ albumLabel }}</span>
    <span class="track-duration-head"><Clock3 :size="17" /></span>
    <slot name="extraHead"></slot>
    <TrackTableActionsHeader
      v-if="!hideActionsColumn"
      :enable-download-action="enableDownloadAction"
      :hide-action-header="hideActionHeader"
      :show-favorite-action="showFavoriteAction"
    />
  </div>
</template>

<style scoped>
.track-head {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--smw-bg-workspace);
  box-shadow: 0 -16px 0 0 var(--smw-bg-workspace);
  color: var(--smw-text-body);
  font-size: 13px;
}

.track-head > span {
  display: flex;
  align-items: center;
  min-height: inherit;
}

.track-head :slotted(span) {
  display: flex;
  align-items: center;
  min-height: inherit;
}

.track-head > span:last-child {
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-cover-head {
  display: inline-block;
  width: 34px;
  height: 1px;
  flex: 0 0 34px;
}

@media (max-width: 820px) {
  .track-head:not(.has-number-column) .track-album-head,
  .track-head:not(.has-number-column) .track-duration-head,
  .track-head:not(.has-number-column) :slotted(span:nth-of-type(2)),
  .track-head.has-number-column .track-artist-head,
  .track-head.has-number-column .track-album-head,
  .track-head.has-number-column :slotted(span:nth-of-type(1)) {
    display: none;
  }
}
</style>
