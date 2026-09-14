import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import { useLyricsColors } from './useLyricsColors';

interface LyricsViewStyleOptions {
  backgroundCoverUrl: MaybeRefOrGetter<string>;
  lyricFontSize: MaybeRefOrGetter<number>;
}

export function useLyricsViewStyle(options: LyricsViewStyleOptions) {
  const { base, highlight, glow } = useLyricsColors();
  const lyricsViewStyle = computed(() => ({
    '--lyrics-font-size': `${toValue(options.lyricFontSize)}px`,
    '--smw-lyrics-current': highlight.value,
    '--lyrics-base-color': base.value,
    '--lyrics-highlight-color': highlight.value,
    '--lyrics-glow-color': glow.value,
    '--lyrics-cover-bg': toValue(options.backgroundCoverUrl) ? `url("${toValue(options.backgroundCoverUrl)}")` : undefined,
  }));

  return {
    lyricsViewStyle,
  };
}
