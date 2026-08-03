import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';
import { t } from '../i18n';
import type { Locale, LyricLine, Track, TrackLyrics } from '../types/music';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

type LyricsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface LyricsMetadataStateOptions {
  activeTrack: MaybeRefOrGetter<Track | null>;
  isLoadingLyrics: Ref<boolean>;
  lines: Ref<LyricLine[]>;
  locale: MaybeRefOrGetter<Locale>;
  lyricsError: MaybeRefOrGetter<string | null | undefined>;
  lyricsMetadata: MaybeRefOrGetter<TrackLyrics | null | undefined>;
  lyricsStatus: MaybeRefOrGetter<LyricsStatus | undefined>;
}

export function useLyricsMetadataState(options: LyricsMetadataStateOptions) {
  const activeLyrics = computed(() => toValue(options.lyricsMetadata) ?? normalizeTrackLyrics(toValue(options.activeTrack)));
  const isLyricsPending = computed(() => {
    return !options.lines.value.length && (toValue(options.lyricsStatus) === 'loading' || options.isLoadingLyrics.value);
  });
  const emptyLyricsMessage = computed(() => {
    return toValue(options.lyricsStatus) === 'error'
      ? toValue(options.lyricsError) || '歌词加载失败'
      : t(toValue(options.locale), 'noLyrics');
  });
  const hasAssociatedLyrics = computed(() => Boolean(toValue(options.activeTrack)?.associatedLyrics?.lyrics.length));
  const activeArtwork = computed(() => {
    const activeTrack = toValue(options.activeTrack);
    return activeTrack?.associatedArtwork ?? activeTrack?.artwork ?? null;
  });
  const availableLyricFormats = computed(() => {
    const formats = activeLyrics.value?.lyrics.map((variant) => variant.format) ?? [];
    return formats.filter((format, index) => format && formats.indexOf(format) === index);
  });
  const downloadableLyricFormats = computed(() => {
    if (!hasAssociatedLyrics.value) return [];
    const formats = availableLyricFormats.value.length > 0
      ? availableLyricFormats.value
      : (activeLyrics.value?.lyrics[0] ? [activeLyrics.value.lyrics[0].format] : []);
    const items = formats.filter((format, index) => format && formats.indexOf(format) === index);
    if (items.includes('lrc') && !items.includes('txt')) {
      items.push('txt');
    }
    return items;
  });

  return {
    activeArtwork,
    activeLyrics,
    availableLyricFormats,
    downloadableLyricFormats,
    emptyLyricsMessage,
    hasAssociatedLyrics,
    isLyricsPending,
  };
}
