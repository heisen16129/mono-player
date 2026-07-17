<script setup lang="ts">
import { Search } from '@lucide/vue';
import type { Track } from '../types/music';
import { computed, onBeforeUnmount, ref } from 'vue';
import { durationText, songCountLong, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import CollectionHero from './CollectionHero.vue';
import TrackTable from './TrackTable.vue';

const props = defineProps<{
  activeCollection: 'all' | 'favorites';
  activeTrack: Track | null;
  error: string | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  spectrumLevels: number[];
  libraryFilter: 'all' | 'recentAdded' | 'recentPlayed';
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  isPlaylistView?: boolean;
  modelValue: string;
  tracks: Track[];
  useTrackCover?: boolean;
}>();

const emit = defineEmits<{
  chooseFolder: [];
  openArtist: [artistName: string];
  openTrackMenu: [track: Track, x: number, y: number];
  playFavoriteTracks: [];
  playVisibleTracks: [];
  playTrack: [track: Track];
  rescan: [];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
  'update:modelValue': [value: string];
}>();

const trackTableRef = ref<InstanceType<typeof TrackTable> | null>(null);
const isTrackListScrolling = ref(false);
let trackListScrollTimer: number | undefined;
const player = usePlayerStore();

const favoriteStats = computed(() => {
  const totalSeconds = props.tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  const duration = durationText(player.settings.locale, hours, minutes);

  return `${songCountLong(player.settings.locale, props.tracks.length)} · ${duration} · ${t(player.settings.locale, 'localLibrary')}`;
});

const collectionStats = computed(() => {
  const totalSeconds = props.tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  const duration = durationText(player.settings.locale, hours, minutes);

  return `${songCountLong(player.settings.locale, props.tracks.length)} · ${duration} · ${t(player.settings.locale, 'localLibrary')}`;
});

const isWideCollection = computed(() => {
  return true;
});

const collectionTitle = computed(() => {
  if (props.activeCollection === 'favorites') return t(player.settings.locale, 'favorites');
  if (props.libraryFilter === 'recentAdded') return t(player.settings.locale, 'recentAdded');
  if (props.libraryFilter === 'recentPlayed') return t(player.settings.locale, 'recentPlayed');
  return props.libraryTitle;
});

const collectionSubtitle = computed(() => {
  if (props.activeCollection === 'favorites') return props.isPlaylistView ? collectionStats.value : favoriteStats.value;
  if (props.libraryFilter === 'all') return songCountLong(player.settings.locale, props.libraryMeta.count);
  return collectionStats.value;
});

const collectionDate = computed(() => {
  if (props.libraryFilter === 'all' && props.activeCollection !== 'favorites') return '2026-06-14';
  return '2026-06-15';
});

const collectionHeroId = computed(() => {
  if (props.activeCollection === 'favorites') return 'favorites';
  if (props.libraryFilter === 'recentAdded') return 'recent-added';
  if (props.libraryFilter === 'recentPlayed') return 'recent-played';
  return 'library';
});

const collectionEmptyText = computed(() => {
  if (props.activeCollection === 'favorites') return t(player.settings.locale, 'emptyFavorites');
  if (props.libraryFilter === 'recentAdded') return t(player.settings.locale, 'emptyRecentAdded');
  if (props.libraryFilter === 'recentPlayed') return t(player.settings.locale, 'emptyRecentPlayed');
  return t(player.settings.locale, 'emptySongs');
});

const hasPlayableVisibleTracks = computed(() => {
  return props.tracks.some((track) => track.path);
});

const canLocateActiveTrack = computed(() => {
  return Boolean(props.activeTrack && props.tracks.some((track) => track.id === props.activeTrack?.id));
});

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

  await trackTableRef.value?.scrollToTrack(activeTrackId);
}

function handleTrackListScroll(event: Event) {
  isTrackListScrolling.value = true;
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.scrollHeight - target.scrollTop - target.clientHeight < 180) {
    trackTableRef.value?.loadNextPage();
  }

  window.clearTimeout(trackListScrollTimer);
  trackListScrollTimer = window.setTimeout(() => {
    isTrackListScrolling.value = false;
  }, 800);
}

onBeforeUnmount(() => {
  window.clearTimeout(trackListScrollTimer);
});
</script>

<template>
  <section class="workspace" :class="{ 'favorites-workspace': isWideCollection }">
    <header class="workspace-toolbar">
      <label class="search-field top-search">
        <Search :size="16" />
        <input
          :value="modelValue"
          type="search"
          :placeholder="t(player.settings.locale, 'searchPlaceholder')"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </header>

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

    <div
      class="track-scroll-area"
      :class="{ 'is-scrolling': isTrackListScrolling }"
      @scroll="handleTrackListScroll"
    >
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="tracks.length === 0" class="empty-state favorites-empty">
        {{ collectionEmptyText }}
      </p>

      <TrackTable
        v-else
        ref="trackTableRef"
        label="Songs"
        :tracks="tracks"
        :active-track="activeTrack"
        :favorite-track-ids="favoriteTrackIds"
        :spectrum-levels="spectrumLevels"
        :is-playing="isPlaying"
        :wide="isWideCollection"
        enable-artist-links
        enable-context-menu
        @select-track="emit('selectTrack', $event)"
        @play-track="emit('playTrack', $event)"
        @toggle-favorite="emit('toggleFavorite', $event)"
        @open-artist="emit('openArtist', $event)"
        @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
      />
    </div>
  </section>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 12px 22px 24px;
  background: var(--smw-bg-workspace);
}

.workspace-toolbar {
  min-height: 40px;
}

.history-buttons {
  display: flex;
  gap: 8px;
}

.icon-button.muted {
  color: var(--smw-text-muted);
}

.primary-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 7px;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
}

:root[data-theme='dark'] .play-button {
  color: #111111;
}

.square-button {
  border: 1px solid var(--smw-border);
  background: var(--smw-bg-input);
}

.error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--smw-error-border);
  border-radius: 8px;
  color: var(--smw-error-text);
  background: var(--smw-error-bg);
  font-size: 13px;
}

.track-scroll-area {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0;
  scrollbar-color: transparent transparent;
}

.track-scroll-area:hover.is-scrolling {
  scrollbar-color: var(--smw-scrollbar-thumb) transparent;
}

.track-scroll-area::-webkit-scrollbar {
  width: 10px;
}

.track-scroll-area::-webkit-scrollbar-thumb {
  background:
    linear-gradient(transparent, transparent)
    padding-box;
}

.track-scroll-area:hover.is-scrolling::-webkit-scrollbar-thumb {
  background:
    linear-gradient(var(--smw-scrollbar-thumb), var(--smw-scrollbar-thumb))
    padding-box;
}

.track-scroll-area:hover.is-scrolling::-webkit-scrollbar-thumb:hover {
  background:
    linear-gradient(var(--smw-scrollbar-thumb-hover), var(--smw-scrollbar-thumb-hover))
    padding-box;
}

.favorites-empty {
  margin-top: 36px;
}

@media (max-height: 760px) and (min-width: 821px) {
  .workspace {
    padding-top: 10px;
    padding-bottom: 18px;
  }

  .workspace-toolbar {
    min-height: 36px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .workspace {
    padding-top: 8px;
    padding-bottom: 14px;
  }

  .workspace-toolbar {
    min-height: 32px;
  }
}
</style>
