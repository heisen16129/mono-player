<script setup lang="ts">
import { Search, UserRound } from '@lucide/vue';
import type { ComponentPublicInstance } from 'vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import LibraryContentLayout from './LibraryContentLayout.vue';
import TrackTable from './TrackTable.vue';

interface ArtistGroup {
  name: string;
  tracks: Track[];
}

const props = defineProps<{
  activeArtistName: string | null;
  activeTrack: Track | null;
  artistGroups: ArtistGroup[];
  favoriteTrackIds: number[];
  isPlaying: boolean;
  spectrumLevels: number[];
  modelValue: string;
}>();

const emit = defineEmits<{
  openTrackMenu: [track: Track, x: number, y: number];
  playTrack: [track: Track];
  selectArtist: [artistName: string];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
  'update:modelValue': [value: string];
}>();

const player = usePlayerStore();
const artistRowRefs = ref(new Map<string, HTMLElement>());
const trackTableRef = ref<InstanceType<typeof TrackTable> | null>(null);
const isArtistListScrolling = ref(false);
const isArtistTrackScrolling = ref(false);
let artistListScrollTimer: number | undefined;
let artistTrackScrollTimer: number | undefined;

const selectedArtist = computed(() => {
  return props.artistGroups.find((group) => group.name === props.activeArtistName) ?? props.artistGroups[0] ?? null;
});

const totalTrackCount = computed(() => {
  return props.artistGroups.reduce((sum, group) => sum + group.tracks.length, 0);
});

function setArtistRowRef(name: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    artistRowRefs.value.set(name, element);
    return;
  }

  artistRowRefs.value.delete(name);
}

async function scrollSelectedArtistIntoView() {
  const name = selectedArtist.value?.name;
  if (!name) return;

  await nextTick();
  artistRowRefs.value.get(name)?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

function handleArtistListScroll() {
  isArtistListScrolling.value = true;
  window.clearTimeout(artistListScrollTimer);
  artistListScrollTimer = window.setTimeout(() => {
    isArtistListScrolling.value = false;
  }, 800);
}

function handleArtistTrackScroll(event: Event) {
  isArtistTrackScrolling.value = true;
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.scrollHeight - target.scrollTop - target.clientHeight < 180) {
    trackTableRef.value?.loadNextPage();
  }

  window.clearTimeout(artistTrackScrollTimer);
  artistTrackScrollTimer = window.setTimeout(() => {
    isArtistTrackScrolling.value = false;
  }, 800);
}

watch(
  () => selectedArtist.value?.name,
  () => {
    scrollSelectedArtistIntoView();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.clearTimeout(artistListScrollTimer);
  window.clearTimeout(artistTrackScrollTimer);
});
</script>

<template>
  <LibraryContentLayout class="artists-view">
    <template #panel>
      <aside class="library-panel artists-panel">
        <div class="panel-title artists-list-head">
          <h1>
            {{ t(player.settings.locale, 'artists') }}
            <span>{{ artistGroups.length }} 位 · {{ songCount(player.settings.locale, totalTrackCount) }}</span>
          </h1>
        </div>

        <div
          class="artists-list"
          :class="{ 'is-scrolling': isArtistListScrolling }"
          :aria-label="t(player.settings.locale, 'artistsList')"
          @scroll="handleArtistListScroll"
        >
          <button
            v-for="group in artistGroups"
            :key="group.name"
            :ref="(element) => setArtistRowRef(group.name, element)"
            class="artist-row"
            :class="{ selected: selectedArtist?.name === group.name }"
            type="button"
            @click="emit('selectArtist', group.name)"
          >
            <span class="artist-avatar"><UserRound :size="18" /></span>
            <span>
              <strong>{{ group.name }}</strong>
              <small>{{ songCount(player.settings.locale, group.tracks.length) }}</small>
            </span>
          </button>

          <p v-if="artistGroups.length === 0" class="empty-state">{{ t(player.settings.locale, 'emptyArtists') }}</p>
        </div>
      </aside>
    </template>

    <template #detail>
      <section class="artist-detail">
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

        <div class="artist-hero">
          <span class="artist-hero-icon"><UserRound :size="34" /></span>
          <div>
            <h2>{{ selectedArtist?.name || t(player.settings.locale, 'artists') }}</h2>
            <p>{{ songCount(player.settings.locale, selectedArtist?.tracks.length || 0) }}</p>
          </div>
        </div>

        <div
          class="artist-track-scroll"
          :class="{ 'is-scrolling': isArtistTrackScrolling }"
          @scroll="handleArtistTrackScroll"
        >
          <TrackTable
            v-if="selectedArtist"
            ref="trackTableRef"
            class="artist-track-table"
            :label="t(player.settings.locale, 'artistSongs')"
            :tracks="selectedArtist.tracks"
            :active-track="activeTrack"
            :favorite-track-ids="favoriteTrackIds"
            :spectrum-levels="spectrumLevels"
            :is-playing="isPlaying"
            wide
            enable-context-menu
            @open-track-menu="(track, x, y) => emit('openTrackMenu', track, x, y)"
            @select-track="emit('selectTrack', $event)"
            @play-track="emit('playTrack', $event)"
            @toggle-favorite="emit('toggleFavorite', $event)"
          />
        </div>
      </section>
    </template>
  </LibraryContentLayout>
</template>

<style scoped>
.artists-panel {
  min-width: 0;
}

.artists-list {
  display: grid;
  align-content: start;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-right: -12px;
  padding-right: 12px;
  scrollbar-color: transparent transparent;
}

.artists-list.is-scrolling {
  scrollbar-color: var(--smw-scrollbar-thumb) transparent;
}

.artists-list::-webkit-scrollbar {
  width: 10px;
}

.artists-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: transparent;
  background-clip: content-box;
  border: 3px solid transparent;
}

.artists-list.is-scrolling::-webkit-scrollbar-thumb {
  background:
    linear-gradient(var(--smw-scrollbar-thumb), var(--smw-scrollbar-thumb))
    content-box;
}

.artists-list.is-scrolling::-webkit-scrollbar-thumb:hover {
  background:
    linear-gradient(var(--smw-scrollbar-thumb-hover), var(--smw-scrollbar-thumb-hover))
    content-box;
}

.artists-list-head h1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.artists-list-head h1 span {
  color: var(--smw-text-secondary);
  font-size: 13px;
  font-weight: 400;
}

.artist-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 54px;
  margin-right: -12px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.artist-row:hover,
.artist-row.selected {
  background: var(--smw-bg-selected);
}

.artist-avatar,
.artist-hero-icon {
  display: grid;
  place-items: center;
  border: 1px solid var(--smw-border);
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
}

.artist-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

.artist-row strong,
.artist-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-row strong {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 620;
}

.artist-row small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.artist-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 12px 22px 24px;
  background: var(--smw-bg-workspace);
}

.artist-hero {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  padding: 18px 8px 26px;
}

.artist-hero-icon {
  width: 86px;
  height: 86px;
  border-radius: 50%;
}

.artist-hero h2 {
  margin: 0 0 8px;
  color: var(--smw-text-primary);
  font-size: 30px;
  line-height: 1.15;
}

.artist-hero p {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
}

.artist-track-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0;
  scrollbar-color: transparent transparent;
}

.artist-track-scroll.is-scrolling {
  scrollbar-color: var(--smw-scrollbar-thumb) transparent;
}

.artist-track-scroll::-webkit-scrollbar {
  width: 10px;
}

.artist-track-scroll::-webkit-scrollbar-thumb {
  background:
    linear-gradient(transparent, transparent)
    padding-box;
}

.artist-track-scroll.is-scrolling::-webkit-scrollbar-thumb {
  background:
    linear-gradient(var(--smw-scrollbar-thumb), var(--smw-scrollbar-thumb))
    padding-box;
}

.artist-track-scroll.is-scrolling::-webkit-scrollbar-thumb:hover {
  background:
    linear-gradient(var(--smw-scrollbar-thumb-hover), var(--smw-scrollbar-thumb-hover))
    padding-box;
}
</style>
