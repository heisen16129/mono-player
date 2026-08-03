import { ref, watch, type Ref } from 'vue';
import { isTauriRuntime, resolveLyricsSource } from '../services/music';
import type { LyricLine, Track } from '../types/music';
import { parseRawLyrics } from '../utils/lyrics';

interface DesktopLyricsLoaderOptions {
  activeTrack: Ref<Track | null>;
  lyricContent: Ref<string | null>;
  lyricFormat: Ref<string | null>;
}

export function useDesktopLyricsLoader({ activeTrack, lyricContent, lyricFormat }: DesktopLyricsLoaderOptions) {
  const lyricLines = ref<LyricLine[]>([]);
  const isLoading = ref(false);
  let lyricsLoadRequestId = 0;

  watch(
    () => [activeTrack.value?.path, lyricContent.value, lyricFormat.value] as const,
    async ([path, content, format]) => {
      const requestId = (lyricsLoadRequestId += 1);
      lyricLines.value = [];
      if (!path && !content) {
        isLoading.value = false;
        return;
      }

      isLoading.value = true;
      try {
        const lines = isTauriRuntime()
          ? await resolveLyricsSource({ content, format })
          : parseRawLyrics(content ?? '');
        if (requestId !== lyricsLoadRequestId) return;
        lyricLines.value = normalizeLyricLines(lines);
      } finally {
        if (requestId === lyricsLoadRequestId) {
          isLoading.value = false;
        }
      }
    },
    { immediate: true },
  );

  function stopLyricsLoading() {
    lyricsLoadRequestId += 1;
    isLoading.value = false;
  }

  return {
    isLoading,
    lyricLines,
    stopLyricsLoading,
  };
}

function normalizeLyricLines(lines: LyricLine[]) {
  return lines.filter((line) => {
    const text = line.text.trim();
    return text && text !== '...';
  });
}
