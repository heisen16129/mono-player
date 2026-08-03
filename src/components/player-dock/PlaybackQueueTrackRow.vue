<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale, Track } from '../../types/music';
import TrackCoverThumb from '../TrackCoverThumb.vue';
import PlaybackQueueTrackDuration from './PlaybackQueueTrackDuration.vue';
import PlaybackQueueTrackInfo from './PlaybackQueueTrackInfo.vue';

defineProps<{
  active: boolean;
  index: number;
  isLoading: boolean;
  isPlaying: boolean;
  locale: Locale;
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  spectrumLevels: number[];
  track: Track;
}>();

const emit = defineEmits<{
  playTrack: [track: Track];
  setTrackRef: [trackId: number, element: unknown];
}>();
</script>

<template>
  <button
    :ref="(element) => emit('setTrackRef', track.id, element)"
    class="queue-track"
    :class="{
      'is-current': active,
      'has-index': showTrackNumbers,
      'has-cover': showTrackCovers,
    }"
    type="button"
    @click="emit('playTrack', track)"
  >
    <span v-if="showTrackNumbers" class="queue-index">
      {{ index + 1 }}
    </span>
    <TrackCoverThumb
      v-if="showTrackCovers"
      class="queue-cover"
      :track="track"
      :active="active"
      :playing="isPlaying"
      :loading="isLoading"
      :spectrum-levels="spectrumLevels"
    />
    <PlaybackQueueTrackInfo :artist="track.artist || t(locale, 'unknownArtist')" :title="track.title" />
    <PlaybackQueueTrackDuration :duration="track.duration" />
  </button>
</template>

<style scoped>
.queue-track {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 48px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.queue-track.has-index {
  grid-template-columns: 28px minmax(0, 1fr) auto;
}

.queue-track.has-cover {
  grid-template-columns: 30px minmax(0, 1fr) auto;
}

.queue-track.has-index.has-cover {
  grid-template-columns: 28px 30px minmax(0, 1fr) auto;
}

.queue-track:hover {
  background: var(--smw-bg-hover);
}

.queue-track.is-current {
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
}

.queue-index {
  display: grid;
  place-items: center;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.queue-cover {
  justify-self: center;
}

</style>
