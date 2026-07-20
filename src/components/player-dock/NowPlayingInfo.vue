<script setup lang="ts">
import { ChevronsDown, ChevronsUp } from '@lucide/vue';
import { formatDuration } from '../../utils/format';
import { t } from '../../i18n';
import type { Locale, Track } from '../../types/music';
import DefaultCover from '../DefaultCover.vue';

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
    <button class="cover-button" type="button" :aria-label="t(locale, 'openLyrics')" @click="emit('openLyrics')">
      <Transition name="cover-roll" mode="out-in">
        <span v-if="lyricsOpen" key="collapse" class="cover-mini cover-collapse-icon">
          <ChevronsDown :size="24" />
        </span>
        <span v-else key="artwork" class="cover-mini cover-artwork-shell">
          <img v-if="coverUrl" class="cover-image" :src="coverUrl" alt="" @error="emit('coverError')" />
          <DefaultCover v-else class="cover-placeholder-fill" :size="24" :stroke-width="2.4" />
        </span>
      </Transition>
      <span v-if="!lyricsOpen && coverUrl" class="cover-hover-cue" aria-hidden="true">
        <ChevronsUp :size="24" />
      </span>
    </button>
    <Transition name="info-roll" mode="out-in">
      <span v-if="!lyricsOpen" key="track" class="track-info">
        <strong>{{ activeTrack?.title || t(locale, 'unknownTrack') }}</strong>
        <small>{{ activeTrack ? (activeTrack.artist || t(locale, 'unknownArtist')) : t(locale, 'readyToPlay') }}</small>
      </span>
      <span v-else key="blank" class="track-info track-info-lyrics-open">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </span>
    </Transition>
    <span class="time-pair">
      <span>{{ formatDuration(currentTime) }}</span>
      <span>/</span>
      <span>{{ totalDurationLabel }}</span>
    </span>
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

.cover-button {
  position: relative;
  display: block;
  width: 52px;
  height: 52px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  outline: none;
  background: transparent;
  cursor: pointer;
  perspective: 180px;
  transition: transform 160ms ease;
}

.cover-button:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 42%, transparent);
}

.cover-button:active {
  transform: translateY(-1px) scale(0.98);
}

.mini-now .cover-mini {
  display: block;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
}

.mini-now .cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-artwork-shell {
  overflow: hidden;
}

.cover-placeholder-fill {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.mini-now .cover-collapse-icon {
  display: grid;
  place-items: center;
  color: var(--smw-text-primary);
  background: transparent;
  opacity: 0;
  transform: translateY(-8px) rotateX(52deg);
  transform-origin: 50% 50%;
  transition:
    opacity 160ms ease,
    transform 240ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-style: preserve-3d;
}

.cover-button:hover .cover-collapse-icon,
.cover-button:focus-visible .cover-collapse-icon {
  opacity: 1;
  transform: translateY(0) rotateX(0deg);
}

.cover-roll-enter-active,
.cover-roll-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-style: preserve-3d;
}

.cover-roll-enter-from {
  opacity: 0;
  transform: translateY(14px) rotateX(-72deg);
}

.cover-roll-leave-to {
  opacity: 0;
  transform: translateY(-14px) rotateX(72deg);
}

.info-roll-enter-active,
.info-roll-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-origin: 50% 50%;
  transform-style: preserve-3d;
}

.info-roll-enter-from {
  opacity: 0;
  transform: translateY(10px) rotateX(-54deg);
}

.info-roll-leave-to {
  opacity: 0;
  transform: translateY(-10px) rotateX(54deg);
}

.cover-hover-cue {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(31, 32, 40, 0.62);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 150ms ease, transform 150ms ease;
}

.cover-button:hover .cover-hover-cue,
.cover-button:focus-visible .cover-hover-cue {
  opacity: 1;
  transform: translateY(0);
}

.track-info {
  display: grid;
  height: 52px;
  align-content: space-between;
  box-sizing: border-box;
  gap: 0;
  min-width: 0;
  padding: 5px 0;
}

.mini-now strong {
  display: block;
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 14px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-now small {
  display: block;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 13px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-pair {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--smw-text-muted);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

.time-pair span:first-child {
  color: var(--smw-text-primary);
  font-weight: 500;
}

.time-pair span:nth-child(2) {
  color: var(--smw-text-muted);
}

.time-pair span:last-child {
  color: var(--smw-text-secondary);
}
</style>
