<script setup lang="ts">
import { Pause, Play, Repeat1, Repeat2, Shuffle, SkipBack, SkipForward } from '@lucide/vue';
import { onBeforeUnmount, ref } from 'vue';
import { t } from '../../i18n';
import type { Locale, PlaybackMode, Track } from '../../types/music';
import TrackFavoriteActionButton from '../TrackFavoriteActionButton.vue';

defineProps<{
  activeTrack: Track | null;
  isFavorite: boolean;
  isPlaying: boolean;
  locale: Locale;
  playbackMode: PlaybackMode;
  playbackModeLabel: string;
}>();

const emit = defineEmits<{
  next: [];
  previous: [];
  toggleFavorite: [];
  togglePlayback: [];
  togglePlaybackMode: [];
}>();

const isPlayButtonAnimating = ref(false);
let playButtonAnimationTimer = 0;

function animatePlayButton() {
  isPlayButtonAnimating.value = false;
  window.clearTimeout(playButtonAnimationTimer);
  requestAnimationFrame(() => {
    isPlayButtonAnimating.value = true;
    playButtonAnimationTimer = window.setTimeout(() => {
      isPlayButtonAnimating.value = false;
    }, 260);
  });
}

function handleTogglePlayback() {
  animatePlayButton();
  emit('togglePlayback');
}

onBeforeUnmount(() => {
  window.clearTimeout(playButtonAnimationTimer);
});
</script>

<template>
  <div class="transport">
    <TrackFavoriteActionButton
      :disabled="!activeTrack"
      :is-favorite="isFavorite"
      :label="t(locale, 'favorite')"
      :title="t(locale, 'favorite')"
      @toggle="emit('toggleFavorite')"
    />
    <button class="icon-button" type="button" :disabled="!activeTrack" aria-label="Previous" @click="emit('previous')">
      <SkipBack :size="18" fill="currentColor" />
    </button>
    <button class="play-button" :class="{ 'is-clicking': isPlayButtonAnimating }" type="button" :disabled="!activeTrack" @click="handleTogglePlayback">
      <Pause v-if="isPlaying" :size="22" fill="currentColor" />
      <Play v-else :size="22" fill="currentColor" />
    </button>
    <button class="icon-button" type="button" :disabled="!activeTrack" aria-label="Next" @click="emit('next')">
      <SkipForward :size="18" fill="currentColor" />
    </button>
    <button class="icon-button" type="button" :aria-label="playbackModeLabel" :title="playbackModeLabel" @click="emit('togglePlaybackMode')">
      <Shuffle v-if="playbackMode === 'shuffle'" :size="18" />
      <Repeat2 v-else-if="playbackMode === 'repeat'" :size="18" />
      <Repeat1 v-else :size="18" />
    </button>
  </div>
</template>

<style scoped>
.transport {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  transform: translate(-50%, -50%);
}

.play-button {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
  transition:
    transform 120ms ease-out,
    filter 180ms ease;
  will-change: transform;
}

.play-button:not(:disabled):active {
  transform: scale(0.92);
}

.play-button.is-clicking:not(:disabled) {
  animation: play-button-click 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes play-button-click {
  0% {
    transform: scale(0.94);
    filter: brightness(0.98);
  }

  58% {
    transform: scale(1.07);
    filter: brightness(1.08);
  }

  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .play-button {
    transition: filter 120ms ease;
  }

  .play-button:not(:disabled):active {
    transform: none;
    filter: brightness(0.94);
  }

  .play-button.is-clicking:not(:disabled) {
    animation: none;
  }
}
</style>
