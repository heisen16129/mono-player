<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale, Track } from '../../types/music';
import PlaybackQueueTrackRow from './PlaybackQueueTrackRow.vue';

defineProps<{
  activeTrack: Track | null;
  isPlaying: boolean;
  isPreparingActiveTrack: boolean;
  locale: Locale;
  queueTracks: readonly Track[];
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  spectrumLevels: number[];
}>();

const emit = defineEmits<{
  playTrack: [track: Track];
  setTrackRef: [trackId: number, element: unknown];
}>();
</script>

<template>
  <div v-if="queueTracks.length > 0" class="queue-list">
    <PlaybackQueueTrackRow
      v-for="(track, index) in queueTracks"
      :key="`${track.id}-${index}`"
      :active="activeTrack?.id === track.id"
      :index="index"
      :is-loading="isPreparingActiveTrack && activeTrack?.id === track.id"
      :is-playing="isPlaying"
      :locale="locale"
      :show-track-covers="showTrackCovers"
      :show-track-numbers="showTrackNumbers"
      :spectrum-levels="activeTrack?.id === track.id ? spectrumLevels : []"
      :track="track"
      @play-track="emit('playTrack', $event)"
      @set-track-ref="(trackId, element) => emit('setTrackRef', trackId, element)"
    />
  </div>

  <p v-else class="queue-empty">{{ t(locale, 'emptyQueue') }}</p>
</template>

<style scoped>
.queue-list {
  display: grid;
  max-height: 390px;
  overflow: auto;
  padding: 8px;
}

.queue-empty {
  margin: 0;
  padding: 30px 16px;
  color: var(--smw-text-secondary);
  text-align: center;
}
</style>
