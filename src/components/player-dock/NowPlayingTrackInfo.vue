<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '../../i18n';
import type { Locale, Track } from '../../types/music';
import { artistLabel } from '../../utils/artist';

const props = defineProps<{
  activeTrack: Track | null;
  locale: Locale;
  lyricsOpen: boolean;
}>();

const titleRef = ref<HTMLElement | null>(null);
const titleTextRef = ref<HTMLElement | null>(null);
const isTitleOverflowing = ref(false);
const titleMarqueeDistance = ref('0px');

function measureTitleOverflow() {
  const container = titleRef.value;
  const text = titleTextRef.value;
  if (!container || !text) return;
  const textWidth = text.scrollWidth;
  isTitleOverflowing.value = textWidth - container.clientWidth > 1;
  titleMarqueeDistance.value = `${textWidth + 36}px`;
}

watch(
  () => [props.activeTrack?.title, props.lyricsOpen] as const,
  () => {
    void nextTick(measureTitleOverflow);
  },
);

onMounted(() => {
  measureTitleOverflow();
  window.addEventListener('resize', measureTitleOverflow);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureTitleOverflow);
});
</script>

<template>
  <Transition name="info-roll" mode="out-in">
    <span v-if="!lyricsOpen" key="track" class="track-info" :class="{ 'is-empty': !activeTrack }">
      <strong
        ref="titleRef"
        :class="{ 'is-overflowing': isTitleOverflowing }"
        :style="{ '--title-marquee-distance': titleMarqueeDistance }"
      >
        <span class="title-marquee-track">
          <span ref="titleTextRef" class="title-marquee-text">{{ activeTrack?.title || t(locale, 'noMusic') }}</span>
          <span v-if="isTitleOverflowing" class="title-marquee-text" aria-hidden="true">{{ activeTrack?.title || t(locale, 'noMusic') }}</span>
        </span>
      </strong>
      <small>{{ activeTrack ? artistLabel(activeTrack.artist, t(locale, 'unknownArtist')) : '' }}</small>
    </span>
    <span v-else key="blank" class="track-info track-info-lyrics-open">
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
    </span>
  </Transition>
</template>

<style scoped>
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

.track-info {
  display: grid;
  height: 52px;
  align-content: space-between;
  box-sizing: border-box;
  gap: 0;
  min-width: 0;
  padding: 5px 0;
}

.track-info strong {
  display: block;
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
}

.title-marquee-track {
  display: inline-flex;
  gap: 36px;
  min-width: 100%;
  transform: translateX(0);
}

.title-marquee-text {
  flex: 0 0 auto;
}

.track-info:not(.is-empty) strong.is-overflowing .title-marquee-track {
  animation: now-playing-title-marquee 8s linear infinite;
}

@keyframes now-playing-title-marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(calc(-1 * var(--title-marquee-distance, 0px)));
  }
}

.track-info.is-empty {
  align-content: center;
}

.track-info.is-empty strong {
  color: var(--smw-text-secondary);
}

.track-info.is-empty small {
  display: none;
}

.track-info small {
  display: block;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 13px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
