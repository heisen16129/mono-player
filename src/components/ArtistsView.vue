<script setup lang="ts">
import { computed } from 'vue';
import { songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { ArtistTrackListListeners, ArtistTrackListProps } from '../types/artists';
import type { ArtistGroup } from '../types/library';
import type { Track } from '../types/music';
import ArtistHero from './artists/ArtistHero.vue';
import ArtistListPanel from './artists/ArtistListPanel.vue';
import ArtistSearchToolbar from './artists/ArtistSearchToolbar.vue';
import ArtistTrackList from './artists/ArtistTrackList.vue';
import LibraryContentLayout from './LibraryContentLayout.vue';

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

const selectedArtist = computed(() => {
  return props.artistGroups.find((group) => group.name === props.activeArtistName) ?? props.artistGroups[0] ?? null;
});

const artistHeroTitle = computed(() => {
  return selectedArtist.value?.name || t(player.settings.locale, 'artists');
});

const artistHeroTrackCount = computed(() => {
  return songCount(player.settings.locale, selectedArtist.value?.tracks.length || 0);
});

const artistTrackListProps = computed<ArtistTrackListProps>(() => ({
  activeTrack: props.activeTrack,
  favoriteTrackIds: props.favoriteTrackIds,
  isPlaying: props.isPlaying,
  label: t(player.settings.locale, 'artistSongs'),
  spectrumLevels: props.spectrumLevels,
  tracks: selectedArtist.value?.tracks ?? null,
}));

const artistTrackListListeners: ArtistTrackListListeners = {
  onOpenTrackMenu: (...args) => emit('openTrackMenu', ...args),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onSelectTrack: (...args) => emit('selectTrack', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};
</script>

<template>
  <LibraryContentLayout class="artists-view">
    <template #panel>
      <ArtistListPanel
        :active-artist-name="activeArtistName"
        :artist-groups="artistGroups"
        @select-artist="emit('selectArtist', $event)"
      />
    </template>

    <template #detail>
      <section class="artist-detail">
        <ArtistSearchToolbar
          :model-value="modelValue"
          :placeholder="t(player.settings.locale, 'searchPlaceholder')"
          @update:model-value="emit('update:modelValue', $event)"
        />

        <ArtistHero :title="artistHeroTitle" :track-count-label="artistHeroTrackCount" />

        <ArtistTrackList
          v-bind="{ ...artistTrackListProps, ...artistTrackListListeners }"
        />
      </section>
    </template>
  </LibraryContentLayout>
</template>

<style scoped>
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

</style>


