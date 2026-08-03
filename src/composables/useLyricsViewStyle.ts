import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';

interface LyricsViewStyleOptions {
  backgroundCoverUrl: MaybeRefOrGetter<string>;
  lyricFontColor: MaybeRefOrGetter<string>;
  lyricFontSize: MaybeRefOrGetter<number>;
  useThemeLyricColor: MaybeRefOrGetter<boolean>;
}

export function useLyricsViewStyle(options: LyricsViewStyleOptions) {
  const lyricsViewStyle = computed(() => ({
    '--lyrics-font-size': `${toValue(options.lyricFontSize)}px`,
    '--smw-lyrics-current': toValue(options.useThemeLyricColor) ? undefined : toValue(options.lyricFontColor),
    '--lyrics-cover-bg': toValue(options.backgroundCoverUrl) ? `url("${toValue(options.backgroundCoverUrl)}")` : undefined,
  }));

  return {
    lyricsViewStyle,
  };
}
