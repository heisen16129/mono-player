<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useScrollingState } from '../../composables/useScrollingState';
import { songCount, t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import type { ArtistGroup } from '../../types/library';
import EmptyState from '../EmptyState.vue';
import ArtistListHeader from './ArtistListHeader.vue';
import ArtistListRow from './ArtistListRow.vue';

type ArtistListRowInstance = InstanceType<typeof ArtistListRow>;

const props = defineProps<{
  activeArtistName: string | null;
  artistGroups: ArtistGroup[];
}>();

const emit = defineEmits<{
  selectArtist: [artistName: string];
}>();

const player = usePlayerStore();
const artistRowRefs = ref(new Map<string, HTMLElement>());
const { isScrolling: isArtistListScrolling, showScrolling: showArtistListScrolling } = useScrollingState();

const selectedArtist = computed(() => {
  return props.artistGroups.find((group) => group.name === props.activeArtistName) ?? props.artistGroups[0] ?? null;
});

const totalTrackCount = computed(() => {
  return props.artistGroups.reduce((sum, group) => sum + group.tracks.length, 0);
});

const artistSummary = computed(() => {
  return `${props.artistGroups.length} 位 · ${songCount(player.settings.locale, totalTrackCount.value)}`;
});

function setArtistRowRef(name: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    artistRowRefs.value.set(name, element);
    return;
  }

  const rowElement = (element as ArtistListRowInstance | null)?.rowElement ?? null;
  if (rowElement) {
    artistRowRefs.value.set(name, rowElement);
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
  showArtistListScrolling();
}

watch(
  () => selectedArtist.value?.name,
  () => {
    scrollSelectedArtistIntoView();
  },
  { immediate: true },
);
</script>

<template>
  <aside class="library-panel artists-panel">
    <ArtistListHeader :title="t(player.settings.locale, 'artists')" :summary="artistSummary" />

    <div
      class="artists-list transient-scrollbar"
      :class="{ 'is-scrolling': isArtistListScrolling }"
      :aria-label="t(player.settings.locale, 'artistsList')"
      @scroll="handleArtistListScroll"
    >
      <ArtistListRow
        v-for="group in artistGroups"
        :key="group.name"
        :ref="(element) => setArtistRowRef(group.name, element)"
        :name="group.name"
        :selected="selectedArtist?.name === group.name"
        :song-count-label="songCount(player.settings.locale, group.tracks.length)"
        @select="emit('selectArtist', group.name)"
      />

      <EmptyState v-if="artistGroups.length === 0" :message="t(player.settings.locale, 'emptyArtists')" />
    </div>
  </aside>
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
}

</style>
