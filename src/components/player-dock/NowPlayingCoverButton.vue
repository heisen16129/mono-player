<script setup lang="ts">
import { ChevronsDown } from '@lucide/vue';
import { t } from '../../i18n';
import type { Locale } from '../../types/music';
import DefaultCover from '../DefaultCover.vue';
import NowPlayingCoverHoverCue from './NowPlayingCoverHoverCue.vue';

defineProps<{
  coverUrl: string;
  locale: Locale;
  lyricsOpen: boolean;
}>();

const emit = defineEmits<{
  coverError: [];
  openLyrics: [];
}>();
</script>

<template>
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
    <NowPlayingCoverHoverCue v-if="!lyricsOpen && coverUrl" class="cover-hover-cue-surface" />
  </button>
</template>

<style scoped>
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

.cover-mini {
  display: block;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
}

.cover-image {
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

.cover-collapse-icon {
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

.cover-button:hover .cover-hover-cue-surface,
.cover-button:focus-visible .cover-hover-cue-surface {
  opacity: 1;
  transform: translateY(0);
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

</style>
