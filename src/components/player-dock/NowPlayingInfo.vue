<script setup lang="ts">
import type { Locale, Track } from '../../types/music';
import NowPlayingCoverButton from './NowPlayingCoverButton.vue';
import NowPlayingTimePair from './NowPlayingTimePair.vue';
import NowPlayingTrackInfo from './NowPlayingTrackInfo.vue';

defineProps<{
  activeTrack: Track | null;
  coverUrl: string;
  currentTime: number;
  locale: Locale;
  lyricsOpen: boolean;
  totalDurationLabel: string;
}>();

const emit = defineEmits<{
  coverError: [];
  openLyrics: [];
}>();
</script>

<template>
  <div class="mini-now">
    <NowPlayingCoverButton
      :cover-url="coverUrl"
      :locale="locale"
      :lyrics-open="lyricsOpen"
      @cover-error="emit('coverError')"
      @open-lyrics="emit('openLyrics')"
    />
    <NowPlayingTrackInfo :active-track="activeTrack" :locale="locale" :lyrics-open="lyricsOpen" />
    <NowPlayingTimePair :current-time="currentTime" :total-duration-label="totalDurationLabel" />
  </div>
</template>

<style scoped>
.mini-now {
  display: grid;
  grid-column: 1;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

</style>
