import { computed, type Ref } from 'vue';
import type { LyricLine, Track } from '../types/music';

interface DesktopLyricsCurrentLineOptions {
  activeTrack: Ref<Track | null>;
  currentTime: Ref<number>;
  isLoading: Ref<boolean>;
  lyricLines: Ref<LyricLine[]>;
}

export function useDesktopLyricsCurrentLine({ activeTrack, currentTime, isLoading, lyricLines }: DesktopLyricsCurrentLineOptions) {
  const activeLyricIndex = computed(() => {
    let index = -1;
    for (let lineIndex = 0; lineIndex < lyricLines.value.length; lineIndex += 1) {
      const line = lyricLines.value[lineIndex];
      if (line.time !== null && line.time <= currentTime.value) {
        index = lineIndex;
      }
    }

    if (index >= 0) return index;
    return lyricLines.value.length > 0 ? 0 : -1;
  });

  const currentLyric = computed(() => {
    if (activeLyricIndex.value < 0) {
      if (isLoading.value) return 'Loading lyrics';
      if (activeTrack.value) return activeTrack.value.title;
      return 'Mono Player';
    }

    return lyricLines.value[activeLyricIndex.value]?.text ?? activeTrack.value?.title ?? 'Mono Player';
  });

  const currentTitle = computed(() => activeTrack.value?.title?.trim() || 'Mono Player');

  return {
    currentLyric,
    currentTitle,
  };
}
