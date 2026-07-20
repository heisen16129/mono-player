<script setup lang="ts">
import { Heart, Pause, Play, Repeat1, Repeat2, Shuffle, SkipBack, SkipForward } from '@lucide/vue';
import { t } from '../../i18n';
import type { Locale, PlaybackMode, Track } from '../../types/music';

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
</script>

<template>
  <div class="transport">
    <button
      class="icon-button favorite-button"
      :class="{ 'is-favorite': isFavorite }"
      type="button"
      :disabled="!activeTrack"
      :aria-label="t(locale, 'favorite')"
      :title="t(locale, 'favorite')"
      @click="emit('toggleFavorite')"
    >
      <Heart :size="18" :fill="isFavorite ? 'currentColor' : 'none'" />
    </button>
    <button class="icon-button" type="button" :disabled="!activeTrack" aria-label="Previous" @click="emit('previous')">
      <SkipBack :size="18" fill="currentColor" />
    </button>
    <button class="play-button" type="button" :disabled="!activeTrack" @click="emit('togglePlayback')">
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
}
</style>
