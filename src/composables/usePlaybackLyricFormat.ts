import { computed, ref } from 'vue';
import type { Track, TrackLyrics } from '../types/music';
import { selectTrackLyricsVariant } from '../utils/trackLyrics';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UsePlaybackLyricFormatOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  playbackLyricMetadata: ReadonlyRefValue<TrackLyrics | null | undefined>;
  lyricsTrackKey: (track: Track | null) => string | null;
}

export function usePlaybackLyricFormat({
  activeTrack,
  playbackLyricMetadata,
  lyricsTrackKey,
}: UsePlaybackLyricFormatOptions) {
  const selectedLyricFormatByTrackKey = ref(new Map<string, string>());

  const playbackLyricFormats = computed(() => {
    const formats = playbackLyricMetadata.value?.lyrics.map((variant) => variant.format) ?? [];
    return formats.filter((format, index) => format && formats.indexOf(format) === index);
  });

  const playbackLyricFormat = computed(() => {
    return selectedLyricFormatForTrack(activeTrack.value, playbackLyricMetadata.value);
  });

  const playbackLyricVariant = computed(() => selectTrackLyricsVariant(playbackLyricMetadata.value, playbackLyricFormat.value));

  function selectedLyricTrackKey(track: Track | null) {
    return lyricsTrackKey(track) ?? '';
  }

  function setSelectedLyricFormat(track: Track | null, format: string | null) {
    const key = selectedLyricTrackKey(track);
    if (!key || !format) return;
    const nextFormats = new Map(selectedLyricFormatByTrackKey.value);
    nextFormats.set(key, format);
    selectedLyricFormatByTrackKey.value = nextFormats;
  }

  function selectedLyricFormatForTrack(track: Track | null, lyrics: TrackLyrics | null | undefined) {
    const formats = lyrics?.lyrics.map((variant) => variant.format) ?? [];
    const key = selectedLyricTrackKey(track);
    const selectedFormat = key ? selectedLyricFormatByTrackKey.value.get(key) : null;
    if (selectedFormat && formats.includes(selectedFormat)) return selectedFormat;
    const defaultFormat = lyrics?.defaultFormat?.trim().toLowerCase() ?? null;
    if (defaultFormat && formats.includes(defaultFormat)) return defaultFormat;
    return formats[0] ?? null;
  }

  return {
    playbackLyricFormat,
    playbackLyricFormats,
    playbackLyricVariant,
    setSelectedLyricFormat,
  };
}
