<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TrackCoverEqualizerBarOptions, TrackCoverEqualizerBarStyle, TrackCoverEqualizerProps } from '../types/trackCoverEqualizer';

const PLAYING_BAR_HEIGHTS = [8, 12, 17, 12, 8];
const PAUSED_BAR_HEIGHT = 12;
const PAUSED_BAR_SCALE = 0.16;

const props = defineProps<TrackCoverEqualizerProps>();

const lastSpectrumDebugAt = ref(0);

const spectrumBars = computed<TrackCoverEqualizerBarStyle[]>(() => {
  return createTrackCoverEqualizerBars(props);
});

function createTrackCoverEqualizerBars(options: TrackCoverEqualizerBarOptions): TrackCoverEqualizerBarStyle[] {
  return PLAYING_BAR_HEIGHTS.map((height, index) => createTrackCoverEqualizerBarStyle(options, height, index));
}

function createTrackCoverEqualizerBarStyle(
  { loading, playing, spectrumLevels }: TrackCoverEqualizerBarOptions,
  playingBarHeight: number,
  index: number,
): TrackCoverEqualizerBarStyle {
  if (loading) return {};
  if (!playing) return { transform: 'scaleY(0.16)' };

  const fallback = [0.38, 0.72, 0.52, 0.82, 0.42];
  const value = spectrumLevels?.[index];
  const level = typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0.08, Math.min(1, value))
    : fallback[index];
  const minScale = (PAUSED_BAR_HEIGHT * PAUSED_BAR_SCALE) / playingBarHeight;

  return {
    transform: `scaleY(${Math.min(1, Math.max(minScale, level * 0.5))})`,
  };
}

watch(
  () => [props.playing, props.spectrumLevels] as const,
  ([playing, levels]) => {
    if (!playing) return;
    const now = window.performance.now();
    if (now - lastSpectrumDebugAt.value < 1000) return;
    lastSpectrumDebugAt.value = now;
    const peak = (levels ?? []).reduce((max, value) => Math.max(max, value), 0);
    console.debug('[cover-spectrum]', {
      trackId: props.trackId,
      title: props.trackTitle,
      peak,
      levels: levels ?? [],
      bars: spectrumBars.value,
    });
  },
);
</script>

<template>
  <span class="cover-equalizer" :class="{ 'is-playing': playing, 'is-loading': loading }">
    <i v-for="(bar, index) in spectrumBars" :key="index" :style="bar"></i>
  </span>
</template>

<style scoped>
.cover-equalizer {
  position: absolute;
  z-index: 1;
  left: 50%;
  top: 50%;
  display: inline-flex;
  width: 18px;
  height: 17px;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: #fff;
  transform: translate(-50%, -50%);
}

.cover-equalizer i {
  width: 2px;
  height: 17px;
  border-radius: 3px;
  background: currentColor;
  box-shadow: 0 0 8px color-mix(in srgb, currentColor 38%, transparent);
  opacity: 0.96;
  transform-origin: center;
  transition: transform 90ms linear;
}

.cover-equalizer i:nth-child(1) {
  height: 8px;
}

.cover-equalizer i:nth-child(2) {
  height: 12px;
}

.cover-equalizer i:nth-child(3) {
  height: 17px;
}

.cover-equalizer i:nth-child(4) {
  height: 12px;
}

.cover-equalizer i:nth-child(5) {
  height: 8px;
}

.cover-equalizer:not(.is-playing):not(.is-loading) i {
  height: 12px;
}

.cover-equalizer.is-playing i {
  border-radius: 4px;
  transition-duration: 70ms;
}

.cover-equalizer.is-loading i {
  height: 17px;
  transform: scaleY(0.16);
}

.cover-equalizer.is-loading i:nth-child(1) {
  animation: cover-loading-wave-1 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(2) {
  animation: cover-loading-wave-2 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(3) {
  animation: cover-loading-wave-3 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(4) {
  animation: cover-loading-wave-4 900ms ease-in-out infinite;
}

.cover-equalizer.is-loading i:nth-child(5) {
  animation: cover-loading-wave-5 900ms ease-in-out infinite;
}

@keyframes cover-loading-wave-1 {
  0%, 32%, 100% { transform: scaleY(0.16); }
  16% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-2 {
  0%, 12%, 44%, 100% { transform: scaleY(0.16); }
  28% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-3 {
  0%, 24%, 56%, 100% { transform: scaleY(0.16); }
  40% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-4 {
  0%, 36%, 68%, 100% { transform: scaleY(0.16); }
  52% { transform: scaleY(0.5); }
}

@keyframes cover-loading-wave-5 {
  0%, 48%, 80%, 100% { transform: scaleY(0.16); }
  64% { transform: scaleY(0.5); }
}
</style>
