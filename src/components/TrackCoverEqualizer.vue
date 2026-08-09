<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { TrackCoverEqualizerBarStyle, TrackCoverEqualizerProps } from '../types/trackCoverEqualizer';

const BAR_COUNT = 5;
const BASELINE_SCALE = 2 / 34;
const MAX_PLAY_SCALE = 1 / 3;
const ATTACK_SMOOTHING = 0.42;
const RELEASE_SMOOTHING = 0.16;
const PAUSE_DECAY = 0.08;
const FFT_LOG_GAIN = 0;
const SPECTRUM_RESPONSE_POWER = 2.1;
const SPECTRUM_ACTIVE_THRESHOLD = 0.015;
const SPECTRUM_ACTIVE_FLOOR = 0.12;
const SETTLE_EPSILON = 0.004;

const props = defineProps<TrackCoverEqualizerProps>();

const barScales = ref<number[]>(Array.from({ length: BAR_COUNT }, () => BASELINE_SCALE));
let animationFrame = 0;

const spectrumBars = computed<TrackCoverEqualizerBarStyle[]>(() => {
  if (props.loading) return Array.from({ length: BAR_COUNT }, () => ({}));
  return barScales.value.map((scale) => ({ transform: `scaleY(${scale})` }));
});

function normalizeSpectrumLevel(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const clamped = Math.max(0, Math.min(1, value));
  if (FFT_LOG_GAIN <= 0) return clamped;
  return Math.log1p(clamped * FFT_LOG_GAIN) / Math.log1p(FFT_LOG_GAIN);
}

function responseLevel(level: number) {
  if (level <= SPECTRUM_ACTIVE_THRESHOLD) return 0;
  const audibleLevel = (level - SPECTRUM_ACTIVE_THRESHOLD) / (1 - SPECTRUM_ACTIVE_THRESHOLD);
  return SPECTRUM_ACTIVE_FLOOR + (1 - SPECTRUM_ACTIVE_FLOOR) * Math.pow(audibleLevel, SPECTRUM_RESPONSE_POWER);
}

function targetScale(index: number) {
  const level = normalizeSpectrumLevel(props.spectrumLevels?.[index]);
  return BASELINE_SCALE + (MAX_PLAY_SCALE - BASELINE_SCALE) * responseLevel(level);
}

function isSettledAtBaseline(scales: number[]) {
  return scales.every((scale) => Math.abs(scale - BASELINE_SCALE) <= SETTLE_EPSILON);
}

function requestAnimation() {
  if (animationFrame) return;
  animationFrame = window.requestAnimationFrame(animateBars);
}

function animateBars() {
  animationFrame = 0;

  if (props.loading) return;

  const nextScales = barScales.value.map((current, index) => {
    if (!props.playing) {
      if (current <= BASELINE_SCALE + SETTLE_EPSILON) return BASELINE_SCALE;
      return Math.max(BASELINE_SCALE, current + (BASELINE_SCALE - current) * PAUSE_DECAY);
    }

    const target = targetScale(index);
    const smoothing = target > current ? ATTACK_SMOOTHING : RELEASE_SMOOTHING;
    return Math.max(BASELINE_SCALE, current + (target - current) * smoothing);
  });

  barScales.value = nextScales;

  if (props.playing || !isSettledAtBaseline(nextScales)) {
    requestAnimation();
  }
}

watch(
  () => props.playing,
  () => requestAnimation(),
  { immediate: true },
);

watch(
  () => props.spectrumLevels,
  () => {
    if (props.playing) requestAnimation();
  },
);

onBeforeUnmount(() => {
  if (animationFrame) {
    window.cancelAnimationFrame(animationFrame);
  }
});
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
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: #fff;
  transform: translate(-50%, -50%);
}

.cover-equalizer i {
  width: 2px;
  height: 100%;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.96;
  transform-origin: center;
  transition: transform 90ms linear;
}

.cover-equalizer.is-playing i {
  border-radius: 999px;
  transition-duration: 70ms;
}

.cover-equalizer.is-loading i {
  height: 100%;
  opacity: 0.72;
  transform: scaleY(0.06);
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
  0%, 32%, 100% { transform: scaleY(0.06); }
  16% { transform: scaleY(0.333333); }
}

@keyframes cover-loading-wave-2 {
  0%, 12%, 44%, 100% { transform: scaleY(0.06); }
  28% { transform: scaleY(0.333333); }
}

@keyframes cover-loading-wave-3 {
  0%, 24%, 56%, 100% { transform: scaleY(0.06); }
  40% { transform: scaleY(0.333333); }
}

@keyframes cover-loading-wave-4 {
  0%, 36%, 68%, 100% { transform: scaleY(0.06); }
  52% { transform: scaleY(0.333333); }
}

@keyframes cover-loading-wave-5 {
  0%, 48%, 80%, 100% { transform: scaleY(0.06); }
  64% { transform: scaleY(0.333333); }
}
</style>
