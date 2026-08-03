<script setup lang="ts">
import type { LyricLine } from '../../types/music';

defineProps<{
  activeLyricIndex: number;
  line: LyricLine;
  lineIndex: number;
  lyricWordProgress: (line: LyricLine, lineIndex: number, wordIndex: number) => string;
}>();

const emit = defineEmits<{
  seek: [line: LyricLine];
}>();
</script>

<template>
  <p
    :class="{
      current: lineIndex === activeLyricIndex,
      previous: lineIndex === activeLyricIndex - 1,
      'previous-far': lineIndex === activeLyricIndex - 2,
      next: lineIndex === activeLyricIndex + 1,
      'next-far': lineIndex === activeLyricIndex + 2,
      'next-farther': lineIndex === activeLyricIndex + 3,
      'can-seek': line.time !== null,
    }"
    :role="line.time !== null ? 'button' : undefined"
    :tabindex="line.time !== null ? 0 : undefined"
    @click="emit('seek', line)"
    @keydown.enter="emit('seek', line)"
    @keydown.space.prevent="emit('seek', line)"
  >
    <template v-if="line.words?.length">
      <span
        v-for="(word, wordIndex) in line.words"
        :key="`${word.time}-${word.text}-${wordIndex}`"
        class="lyric-word"
        :style="{ '--lyric-word-progress': lyricWordProgress(line, lineIndex, wordIndex) }"
      >
        {{ word.text }}
      </span>
    </template>
    <template v-else>{{ line.text }}</template>
  </p>
</template>

<style scoped>
p {
  margin: 0;
  font-size: var(--lyrics-font-size, 22px);
  line-height: 1.25;
  opacity: 0.22;
  transform: scale(0.9);
  transition:
    opacity 240ms ease,
    color 240ms ease,
    transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

p.can-seek {
  cursor: pointer;
}

p.can-seek:hover,
p.can-seek:focus-visible {
  color: var(--smw-lyrics-current);
  outline: none;
}

.current {
  color: var(--smw-lyrics-current);
  font-weight: 680;
  opacity: 1;
  text-shadow: 0 8px 24px color-mix(in srgb, var(--smw-lyrics-current) 18%, transparent);
  transform: scale(1.18);
}

.current .lyric-word {
  display: inline-block;
  color: transparent;
  background:
    linear-gradient(
      90deg,
      var(--smw-lyrics-current) 0 var(--lyric-word-progress, 0%),
      var(--smw-text-secondary) var(--lyric-word-progress, 0%) 100%
    );
  background-clip: text;
  -webkit-background-clip: text;
  text-shadow: 0 8px 24px color-mix(in srgb, var(--smw-lyrics-current) 22%, transparent);
}

.previous {
  opacity: 0.68;
  transform: scale(0.92);
}

.previous-far {
  opacity: 0.48;
  transform: scale(0.9);
}

.next {
  opacity: 0.58;
  transform: scale(0.96);
}

.next-far {
  opacity: 0.44;
  transform: scale(0.94);
}

.next-farther {
  opacity: 0.32;
  transform: scale(0.92);
}
</style>
