<script setup lang="ts">
import { ref } from 'vue';
import EmptyState from '../EmptyState.vue';
import type { LyricLine } from '../../types/music';

defineProps<{
  activeLyricIndex: number;
  emptyMessage: string;
  isEmpty: boolean;
  isLyricsPending: boolean;
  isLyricSyncOpen: boolean;
  isScrolling: boolean;
  label: string;
  lines: LyricLine[];
  loadingText: string;
  lyricWordProgress: (line: LyricLine, lineIndex: number, wordIndex: number) => string;
  scrollThumbTop: number;
}>();

const emit = defineEmits<{
  beginBrowse: [];
  hideScrollbar: [];
  openSearch: [];
  restoreRealtime: [];
  scroll: [];
  seek: [line: LyricLine];
  shiftTiming: [deltaSeconds: number];
  wheel: [];
}>();

const panel = ref<HTMLElement | null>(null);

defineExpose({ panel });
</script>

<template>
  <div class="lyrics-panel-wrap" :class="{ 'is-scrolling': isScrolling }">
    <div
      ref="panel"
      class="lyrics-panel"
      :class="{ 'is-empty': isEmpty }"
      :aria-label="label"
      @pointerdown="emit('beginBrowse')"
      @pointerup="emit('restoreRealtime')"
      @pointercancel="emit('restoreRealtime')"
      @mouseleave="emit('restoreRealtime'); emit('hideScrollbar')"
      @scroll="emit('scroll')"
      @wheel.passive="emit('wheel')"
    >
      <small v-if="isLyricsPending" class="lyrics-hint">{{ loadingText }}</small>
      <EmptyState v-else-if="!lines.length" class-name="lyrics-empty" :message="emptyMessage">
        <template #action>
          <button class="lyrics-search-link" type="button" @click.stop="emit('openSearch')">搜索歌词</button>
        </template>
      </EmptyState>
      <p
        v-for="(line, index) in lines"
        :key="`${line.time ?? 'plain'}-${line.text}-${index}`"
        :class="{
          current: index === activeLyricIndex,
          previous: index === activeLyricIndex - 1,
          'previous-far': index === activeLyricIndex - 2,
          next: index === activeLyricIndex + 1,
          'next-far': index === activeLyricIndex + 2,
          'next-farther': index === activeLyricIndex + 3,
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
            :style="{ '--lyric-word-progress': lyricWordProgress(line, index, wordIndex) }"
          >
            {{ word.text }}
          </span>
        </template>
        <template v-else>{{ line.text }}</template>
      </p>
    </div>
    <span v-if="lines.length" class="lyrics-scrollbar" aria-hidden="true">
      <i :style="{ transform: `translateY(${scrollThumbTop}px)` }"></i>
    </span>
    <div v-if="isLyricSyncOpen" class="lyrics-sync-controls" @pointerdown.stop>
      <button type="button" title="歌词快0.5秒" aria-label="歌词快0.5秒" @click="emit('shiftTiming', 0.5)">
        <span>+</span>
        <strong>0.5</strong>
      </button>
      <button type="button" title="歌词慢0.5秒" aria-label="歌词慢0.5秒" @click="emit('shiftTiming', -0.5)">
        <span>-</span>
        <strong>0.5</strong>
      </button>
    </div>
  </div>
</template>

<style scoped>
.lyrics-panel-wrap {
  position: relative;
  width: 100%;
}

.lyrics-panel {
  display: grid;
  gap: 20px;
  justify-items: center;
  height: clamp(420px, 72vh, 760px);
  overflow-y: auto;
  padding: calc(clamp(420px, 72vh, 760px) * 0.32) 34px calc(clamp(420px, 72vh, 760px) * 0.42) 0;
  color: var(--smw-text-secondary);
  scroll-behavior: smooth;
  text-align: center;
  scrollbar-width: none;
}

.lyrics-panel::-webkit-scrollbar {
  display: none;
}

.lyrics-panel.is-empty {
  align-content: center;
  padding: 0 34px 0 0;
}

.lyrics-hint {
  color: var(--smw-text-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
}

.lyrics-empty {
  display: grid;
  gap: 12px;
  justify-items: center;
}

.lyrics-search-link {
  padding: 0;
  border: 0;
  color: var(--smw-accent-blue, #2f7df6);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
}

.lyrics-search-link:hover,
.lyrics-search-link:focus-visible {
  text-decoration: underline;
  outline: none;
}

.lyrics-panel p {
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

.lyrics-panel p.can-seek {
  cursor: pointer;
}

.lyrics-panel p.can-seek:hover,
.lyrics-panel p.can-seek:focus-visible {
  color: var(--smw-lyrics-current);
  outline: none;
}

.lyrics-panel .current {
  color: var(--smw-lyrics-current);
  font-weight: 680;
  opacity: 1;
  text-shadow: 0 8px 24px color-mix(in srgb, var(--smw-lyrics-current) 18%, transparent);
  transform: scale(1.18);
}

.lyrics-panel .current .lyric-word {
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

.lyrics-panel .previous {
  opacity: 0.68;
  transform: scale(0.92);
}

.lyrics-panel .previous-far {
  opacity: 0.48;
  transform: scale(0.9);
}

.lyrics-panel .next {
  opacity: 0.58;
  transform: scale(0.96);
}

.lyrics-panel .next-far {
  opacity: 0.44;
  transform: scale(0.94);
}

.lyrics-panel .next-farther {
  opacity: 0.32;
  transform: scale(0.92);
}

.lyrics-scrollbar {
  position: absolute;
  top: 50%;
  right: 0;
  width: 4px;
  height: 220px;
  border-radius: 999px;
  background: var(--smw-border);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 160ms ease;
}

.lyrics-panel-wrap:hover.is-scrolling .lyrics-scrollbar {
  opacity: 1;
}

.lyrics-scrollbar i {
  display: block;
  width: 4px;
  height: 66px;
  border-radius: inherit;
  background: var(--smw-text-secondary);
  transition: transform 180ms ease;
}

.lyrics-sync-controls {
  position: absolute;
  top: 50%;
  right: 18px;
  z-index: 2;
  display: grid;
  gap: 16px;
  transform: translateY(-50%);
}

.lyrics-sync-controls button {
  display: grid;
  grid-template-rows: 16px 14px;
  width: 38px;
  height: 38px;
  place-items: center;
  padding: 0;
  border: 1.5px solid color-mix(in srgb, var(--smw-lyrics-current) 78%, var(--smw-text-primary));
  border-radius: 6px;
  color: var(--smw-lyrics-current);
  background: color-mix(in srgb, var(--smw-bg-workspace) 82%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  line-height: 1;
  backdrop-filter: blur(10px);
}

.lyrics-sync-controls button:hover,
.lyrics-sync-controls button:focus-visible {
  background: color-mix(in srgb, var(--smw-bg-hover) 88%, transparent);
  transform: translateY(-1px);
}

.lyrics-sync-controls button span {
  align-self: end;
  font-size: 15px;
  font-weight: 700;
}

.lyrics-sync-controls button strong {
  align-self: start;
  font-size: 11px;
  font-weight: 560;
}
</style>
