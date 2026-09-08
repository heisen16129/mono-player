<script setup lang="ts">
import { ListMusic } from '@lucide/vue';
import { t } from '../../i18n';
import type { Locale, Track } from '../../types/music';
import PlaybackQueueHeader from './PlaybackQueueHeader.vue';
import PlaybackQueueList from './PlaybackQueueList.vue';

defineProps<{
  activeTrack: Track | null;
  isOpen: boolean;
  isPlaying: boolean;
  isPreparingActiveTrack: boolean;
  locale: Locale;
  queueTracks: Track[];
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
}>();

const emit = defineEmits<{
  locate: [];
  playTrack: [track: Track];
  setControl: [element: unknown];
  setTrackRef: [trackId: number, element: unknown];
  toggle: [];
}>();
</script>

<template>
  <div :ref="(element) => emit('setControl', element)" class="queue-control">
    <button
      class="icon-button queue-button"
      :class="{ 'is-active': isOpen }"
      type="button"
      :aria-label="t(locale, 'playbackQueue')"
      :title="t(locale, 'playbackQueue')"
      @click="emit('toggle')"
    >
      <ListMusic :size="18" />
    </button>

    <div v-if="isOpen" class="queue-popover" role="dialog" :aria-label="t(locale, 'nowPlayingQueue')">
      <PlaybackQueueHeader :active-track="activeTrack" :locale="locale" :queue-tracks="queueTracks" @locate="emit('locate')" />

      <PlaybackQueueList
        :active-track="activeTrack"
        :is-playing="isPlaying"
        :is-preparing-active-track="isPreparingActiveTrack"
        :locale="locale"
        :queue-tracks="queueTracks"
        :show-track-covers="showTrackCovers"
        :show-track-numbers="showTrackNumbers"
        @play-track="emit('playTrack', $event)"
        @set-track-ref="(trackId, element) => emit('setTrackRef', trackId, element)"
      />
    </div>
  </div>
</template>

<style scoped>
.queue-control {
  position: relative;
  display: grid;
  place-items: center;
}

.queue-button {
  color: var(--smw-text-body);
}

.queue-popover {
  position: absolute;
  right: 0;
  bottom: 44px;
  z-index: 42;
  display: grid;
  width: min(360px, calc(100vw - 28px));
  max-height: min(460px, calc(100vh - 148px));
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-player-bg);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.14);
}

:global(.mono-window.lyrics-open .queue-popover) {
  --smw-text-primary: rgba(255, 255, 255, 0.96);
  --smw-text-body: rgba(255, 255, 255, 0.9);
  --smw-text-secondary: rgba(255, 255, 255, 0.68);
  --smw-icon-muted: rgba(255, 255, 255, 0.66);
  --smw-border-soft: rgba(255, 255, 255, 0.18);
  --smw-bg-hover: rgba(255, 255, 255, 0.08);
  --smw-bg-selected: rgba(255, 255, 255, 0.16);
  --smw-scrollbar-thumb: rgba(255, 255, 255, 0.34);
  --smw-scrollbar-thumb-hover: rgba(255, 255, 255, 0.52);
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(22, 22, 24, 0.28);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(30px) saturate(1.08);
}

</style>
