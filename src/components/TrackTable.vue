<script setup lang="ts">
import { CheckCircle2, Clock3, Download, Heart } from '@lucide/vue';
import type { ComponentPublicInstance } from 'vue';
import { computed, nextTick, ref, watch } from 'vue';
import { resolveLocale, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { formatDuration } from '../utils/format';
import { downloadTrackKey } from '../utils/trackKey';
import SpinnerIcon from './SpinnerIcon.vue';
import TrackCoverThumb from './TrackCoverThumb.vue';

const props = defineProps<{
  activeTrack: Track | null;
  disableInternalPaging?: boolean;
  downloadedTrackKeys?: string[];
  pendingDownloadTrackKeys?: string[];
  enableDownloadAction?: boolean;
  enableArtistLinks?: boolean;
  extraColumns?: string;
  hideActionHeader?: boolean;
  hideActionsColumn?: boolean;
  enableContextMenu?: boolean;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  label: string;
  preparingTrackId?: number | null;
  recent?: boolean;
  spectrumLevels?: number[];
  tracks: Track[];
  wide?: boolean;
  rowClass?: (track: Track) => string | Record<string, boolean> | null | undefined;
  trackKey?: (track: Track) => string | number;
}>();

defineSlots<{
  extraHead?: () => unknown;
  extraCells?: (props: { track: Track; index: number }) => unknown;
}>();

const emit = defineEmits<{
  openArtist: [artistName: string];
  openTrackMenu: [track: Track, x: number, y: number];
  downloadTrack: [track: Track];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}>();

const player = usePlayerStore();
const PAGE_SIZE = 30;
const trackRowRefs = ref(new Map<number, HTMLElement>());
const visibleCount = ref(PAGE_SIZE);
const favoriteTrackIdSet = computed(() => new Set(props.favoriteTrackIds));
const visibleTracks = computed(() => (
  props.disableInternalPaging ? props.tracks : props.tracks.slice(0, visibleCount.value)
));
const hasMoreTracks = computed(() => !props.disableInternalPaging && visibleCount.value < props.tracks.length);
const downloadedTrackKeySet = computed(() => new Set(props.downloadedTrackKeys ?? []));
const pendingDownloadTrackKeySet = computed(() => new Set(props.pendingDownloadTrackKeys ?? []));
const trackTableStyle = computed(() => ({
  '--track-extra-columns': props.extraColumns ?? '0px',
  '--track-actions-column': props.hideActionsColumn ? '0px' : '54px',
}));
const activeTrackKey = computed(() => (props.activeTrack ? trackKey(props.activeTrack) : null));

watch(
  () => [props.tracks, props.disableInternalPaging] as const,
  () => {
    visibleCount.value = props.disableInternalPaging ? props.tracks.length : PAGE_SIZE;
    trackRowRefs.value.clear();
  },
);

function setTrackRowRef(trackId: number, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    trackRowRefs.value.set(trackId, element);
    return;
  }

  trackRowRefs.value.delete(trackId);
}

function trackKey(track: Track) {
  return props.trackKey?.(track) ?? track.id;
}

function isActiveRow(track: Track) {
  return activeTrackKey.value === trackKey(track);
}

function isFavoriteTrack(track: Track) {
  return favoriteTrackIdSet.value.has(track.id);
}

function isDownloadedTrack(track: Track) {
  return downloadedTrackKeySet.value.has(downloadTrackKey(track));
}

function isPendingDownloadTrack(track: Track) {
  return pendingDownloadTrackKeySet.value.has(downloadTrackKey(track));
}

function canDownloadTrack(track: Track) {
  return !isDownloadedTrack(track) && !isPendingDownloadTrack(track);
}

function getDownloadActionLabel(track: Track) {
  if (isDownloadedTrack(track)) return '已下载';
  if (isPendingDownloadTrack(track)) return '下载中';
  return '下载';
}

function handleTrackClick(event: MouseEvent, track: Track) {
  if (event.detail >= 2) {
    emit('playTrack', track);
    return;
  }

  emit('selectTrack', track);
}

function openTrackArtist(track: Track) {
  emit('openArtist', track.artist?.trim() || t(player.settings.locale, 'unknownArtist'));
}

function handleTrackContextMenu(event: MouseEvent, track: Track) {
  if (!props.enableContextMenu) return;

  event.preventDefault();
  event.stopPropagation();
  emit('selectTrack', track);
  emit('openTrackMenu', track, event.clientX, event.clientY);
}

async function scrollToTrack(trackId: number) {
  const trackIndex = props.tracks.findIndex((track) => track.id === trackId);
  if (trackIndex >= visibleCount.value) {
    visibleCount.value = Math.ceil((trackIndex + 1) / PAGE_SIZE) * PAGE_SIZE;
  }

  await nextTick();
  trackRowRefs.value.get(trackId)?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

function loadNextPage() {
  if (!hasMoreTracks.value) return;
  visibleCount.value = Math.min(props.tracks.length, visibleCount.value + PAGE_SIZE);
}

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
    }"
    :style="trackTableStyle"
    :aria-label="label"
  >
    <div class="track-head">
      <span v-if="player.settings.showTrackNumbers">#</span>
      <span class="track-title">
        <span v-if="player.settings.showTrackCovers" class="track-cover-head"></span>
        {{ resolveLocale(player.settings.locale) === 'en-US' ? 'Title' : '标题' }}
      </span>
      <span>{{ t(player.settings.locale, 'artist') }}</span>
      <span>{{ resolveLocale(player.settings.locale) === 'en-US' ? 'Album' : '专辑' }}</span>
      <span><Clock3 :size="17" /></span>
      <slot name="extraHead"></slot>
      <span v-if="!hideActionsColumn" class="track-actions-head">
        <template v-if="!hideActionHeader">
          <Heart :size="17" />
          <Download v-if="enableDownloadAction" :size="17" />
        </template>
      </span>
    </div>

    <button
      v-for="(track, index) in visibleTracks"
      :key="track.id"
      :ref="(element) => setTrackRowRef(track.id, element)"
      class="track-row"
      :class="[
        { selected: isActiveRow(track), preparing: preparingTrackId === track.id },
        rowClass?.(track),
      ]"
      type="button"
      @click="handleTrackClick($event, track)"
      @contextmenu="handleTrackContextMenu($event, track)"
    >
      <span v-if="player.settings.showTrackNumbers">{{ index + 1 }}</span>
      <span class="track-title">
        <TrackCoverThumb
          v-if="player.settings.showTrackCovers"
          :track="track"
          :active="isActiveRow(track)"
          :loading="preparingTrackId === track.id && isActiveRow(track)"
          :playing="isPlaying && isActiveRow(track)"
          :spectrum-levels="isActiveRow(track) ? spectrumLevels ?? [] : []"
        />
        <span class="track-title-text">{{ track.title }}</span>
      </span>
      <span
        v-if="enableArtistLinks"
        class="track-artist-link"
        role="button"
        tabindex="0"
        @click.stop="openTrackArtist(track)"
        @keydown.enter.stop.prevent="openTrackArtist(track)"
        @keydown.space.stop.prevent="openTrackArtist(track)"
      >
        {{ track.artist || t(player.settings.locale, 'unknownArtist') }}
      </span>
      <span v-else>{{ track.artist || t(player.settings.locale, 'unknownArtist') }}</span>
      <span>{{ track.album || t(player.settings.locale, 'localMusic') }}</span>
      <span>{{ formatDuration(track.duration) }}</span>
      <slot name="extraCells" :track="track" :index="index"></slot>
      <span v-if="!hideActionsColumn" class="track-actions">
        <button
          class="favorite-icon"
          :class="{ 'is-favorite': isFavoriteTrack(track) }"
          type="button"
          :aria-label="t(player.settings.locale, 'toggleFavorite')"
          @click.stop="emit('toggleFavorite', track)"
        >
          <Heart :size="17" :fill="isFavoriteTrack(track) ? 'currentColor' : 'none'" />
        </button>
        <button
          v-if="enableDownloadAction"
          class="download-icon"
          :class="{ 'is-downloaded': isDownloadedTrack(track), 'is-downloading': isPendingDownloadTrack(track) }"
          type="button"
          :aria-label="getDownloadActionLabel(track)"
          :disabled="!canDownloadTrack(track)"
          :title="getDownloadActionLabel(track)"
          @click.stop="canDownloadTrack(track) && emit('downloadTrack', track)"
        >
          <CheckCircle2 v-if="isDownloadedTrack(track)" :size="17" />
          <SpinnerIcon v-else-if="isPendingDownloadTrack(track)" :size="17" />
          <Download v-else :size="17" />
        </button>
      </span>
    </button>
  </section>
</template>

<style scoped>
.track-table {
  display: grid;
  padding: 0;
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
  border-bottom: 1px solid var(--smw-border-soft);
  padding: 0 12px;
  text-align: left;
}

.track-table-number-column .track-head,
.track-table-number-column .track-row {
  grid-template-columns: 42px minmax(150px, 1.35fr) minmax(96px, 0.85fr) minmax(108px, 0.9fr) 76px 52px;
}

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
  background: transparent;
  box-shadow: none;
}

.track-table-wide .track-row:hover {
  background: color-mix(in srgb, var(--smw-bg-hover) 72%, transparent);
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

.track-row > span:not(.track-title) {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row > .track-artist-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  max-width: 100%;
  color: var(--smw-text-secondary);
  cursor: pointer;
  text-decoration: none;
}

.track-row > .track-artist-link:hover {
  color: var(--smw-button-primary);
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--smw-button-primary) 64%, transparent);
  text-underline-offset: 4px;
}

.track-row > .track-artist-link:focus-visible {
  border-radius: 4px;
  outline: 2px solid color-mix(in srgb, var(--smw-button-primary) 42%, transparent);
  outline-offset: 3px;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--smw-button-primary) 64%, transparent);
  text-underline-offset: 4px;
}

.track-row .favorite-icon.is-favorite {
  color: #e5484d;
}

.track-row .favorite-icon,
.track-row .download-icon {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, transform 140ms ease;
}

.track-row .favorite-icon:hover {
  color: #e5484d;
  background: color-mix(in srgb, #e5484d 10%, transparent);
  border-radius: 999px;
}

.track-row .download-icon:hover {
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 10%, transparent);
  border-radius: 999px;
}

.track-row .favorite-icon:active,
.track-row .download-icon:active {
  transform: scale(0.94);
}

.track-row .favorite-icon:focus-visible,
.track-row .download-icon:focus-visible {
  border-radius: 999px;
  outline: 2px solid var(--smw-text-primary);
  outline-offset: 3px;
}

.track-row .favorite-icon.is-favorite svg {
  color: #e5484d;
  fill: currentColor;
  stroke: currentColor;
}

.track-row .download-icon.is-downloaded {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.9;
}

.track-row .download-icon.is-downloaded:hover {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.track-row .download-icon.is-downloading {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.track-row .download-icon.is-downloading:hover {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.track-row .download-icon.is-downloading svg {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.track-actions,
.track-actions-head {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.track-row > .track-actions {
  color: var(--smw-text-secondary);
}

.track-row span:last-child,
.track-head span:last-child {
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

.track-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-table-cover-column .track-row {
  min-height: 44px;
}

.track-table-cover-column .track-title {
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

  .track-head span:nth-child(3),
  .track-head span:nth-child(4),
  .track-head span:nth-child(6),
  .track-row span:nth-child(3),
  .track-row span:nth-child(4),
  .track-row span:nth-child(6) {
    display: none;
  }
}
</style>
