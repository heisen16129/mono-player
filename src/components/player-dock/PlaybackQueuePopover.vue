<script setup lang="ts">
import { ListMusic, LocateFixed } from '@lucide/vue';
import { formatDuration } from '../../utils/format';
import { songCount, t } from '../../i18n';
import type { Locale, Track } from '../../types/music';
import TrackCoverThumb from '../TrackCoverThumb.vue';

defineProps<{
  activeTrack: Track | null;
  isOpen: boolean;
  isPlaying: boolean;
  isPreparingActiveTrack: boolean;
  locale: Locale;
  queueTracks: Track[];
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  spectrumLevels: number[];
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
      <header class="queue-popover-head">
        <div class="queue-title-actions">
          <strong>{{ t(locale, 'playbackQueue') }}</strong>
          <button
            class="queue-locate-button"
            type="button"
            :disabled="!activeTrack || !queueTracks.some((track) => track.id === activeTrack?.id)"
            :aria-label="t(locale, 'locateCurrentTrack')"
            :title="t(locale, 'locateCurrentTrack')"
            @click="emit('locate')"
          >
            <LocateFixed :size="15" />
          </button>
        </div>
        <span>{{ songCount(locale, queueTracks.length) }}</span>
      </header>

      <div v-if="queueTracks.length > 0" class="queue-list">
        <button
          v-for="(track, index) in queueTracks"
          :key="`${track.id}-${index}`"
          :ref="(element) => emit('setTrackRef', track.id, element)"
          class="queue-track"
          :class="{
            'is-current': activeTrack?.id === track.id,
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
            :active="activeTrack?.id === track.id"
            :playing="isPlaying"
            :loading="isPreparingActiveTrack && activeTrack?.id === track.id"
            :spectrum-levels="activeTrack?.id === track.id ? spectrumLevels : []"
          />
          <span class="queue-info">
            <strong>{{ track.title }}</strong>
            <small>{{ track.artist || t(locale, 'unknownArtist') }}</small>
          </span>
          <time>{{ formatDuration(track.duration) }}</time>
        </button>
      </div>

      <p v-else class="queue-empty">{{ t(locale, 'emptyQueue') }}</p>
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
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
}

.queue-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.queue-popover-head strong {
  color: var(--smw-text-primary);
  font-size: 15px;
}

.queue-title-actions {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.queue-locate-button {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.queue-locate-button:hover {
  color: var(--smw-text-primary);
}

.queue-locate-button:disabled {
  cursor: default;
  color: var(--smw-icon-muted);
  opacity: 0.42;
}

.queue-popover-head span {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.queue-list {
  display: grid;
  max-height: 390px;
  overflow: auto;
  padding: 6px;
}

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

.queue-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.queue-info strong,
.queue-info small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-info strong {
  font-size: 13px;
  font-weight: 600;
}

.queue-info small,
.queue-track time {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.queue-track time {
  padding-right: 4px;
  font-variant-numeric: tabular-nums;
}

.queue-empty {
  margin: 0;
  padding: 30px 16px;
  color: var(--smw-text-secondary);
  text-align: center;
}
</style>
