import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { LyricLine } from '../types/music';

export function useLyricsHighlight(options: {
  currentTime: ComputedRef<number>;
  isPlaying: ComputedRef<boolean>;
  lines: Ref<LyricLine[]>;
  lyricTimeOffset: Ref<number>;
}) {
  const smoothCurrentTime = ref(0);
  let lyricAnimationFrame = 0;
  let lastLyricFrameAt = 0;

  const syncedLyricTime = computed(() => smoothCurrentTime.value + options.lyricTimeOffset.value);

  const activeLyricIndex = computed(() => {
    let timedIndex = -1;
    for (let index = 0; index < options.lines.value.length; index += 1) {
      const line = options.lines.value[index];
      if (line.time !== null && line.time <= syncedLyricTime.value) {
        timedIndex = index;
      }
    }

    if (timedIndex >= 0) return timedIndex;
    return options.lines.value.length > 0 ? 0 : -1;
  });

  function activeLyricWordIndex(line: LyricLine, currentTime = syncedLyricTime.value) {
    if (!line.words?.length) return -1;

    let activeIndex = -1;
    for (let index = 0; index < line.words.length; index += 1) {
      if (line.words[index].time <= currentTime) {
        activeIndex = index;
      }
    }
    return activeIndex;
  }

  function lyricWordProgress(line: LyricLine, lineIndex: number, wordIndex: number) {
    if (!line.words?.length || lineIndex !== activeLyricIndex.value) return '0%';

    const currentTime = syncedLyricTime.value;
    const word = line.words[wordIndex];
    if (currentTime < word.time) return '0%';

    const activeWordIndex = activeLyricWordIndex(line, currentTime);
    if (wordIndex < activeWordIndex) return '100%';
    if (wordIndex > activeWordIndex) return '0%';

    if (typeof word.duration !== 'number' || !Number.isFinite(word.duration) || word.duration <= 0) {
      return '100%';
    }

    const duration = Math.max(0.08, word.duration);
    const progress = Math.min(1, Math.max(0, (currentTime - word.time) / duration));
    if (progress >= 0.96) return '100%';
    return `${Math.round(progress * 1000) / 10}%`;
  }

  function tickLyricAnimation(now: number) {
    if (lastLyricFrameAt === 0) {
      lastLyricFrameAt = now;
    }

    if (options.isPlaying.value) {
      const elapsed = Math.min(0.25, Math.max(0, (now - lastLyricFrameAt) / 1000));
      smoothCurrentTime.value += elapsed;
    } else {
      smoothCurrentTime.value = options.currentTime.value;
    }

    lastLyricFrameAt = now;
    lyricAnimationFrame = window.requestAnimationFrame(tickLyricAnimation);
  }

  watch(
    options.currentTime,
    (currentTime) => {
      smoothCurrentTime.value = currentTime;
      lastLyricFrameAt = performance.now();
    },
    { immediate: true },
  );

  onMounted(() => {
    lyricAnimationFrame = window.requestAnimationFrame(tickLyricAnimation);
  });

  onBeforeUnmount(() => {
    if (lyricAnimationFrame) {
      window.cancelAnimationFrame(lyricAnimationFrame);
      lyricAnimationFrame = 0;
    }
  });

  return {
    activeLyricIndex,
    lyricWordProgress,
  };
}
