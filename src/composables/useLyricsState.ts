import { computed, ref, type ComputedRef } from 'vue';
import type { Track } from '../types/music';
import { normalizeTrackLyrics, trackLyricFormats } from '../utils/trackLyrics';

type LyricsViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export function useLyricsState(activeTrack: ComputedRef<Track | null>) {
  const lyricsViewState = ref<{
    trackKey: string | null;
    status: LyricsViewStatus;
    error: string | null;
  }>({
    trackKey: null,
    status: 'idle',
    error: null,
  });

  const activeLyricsViewStatus = computed(() => lyricsViewState.value.status);

  const activeLyricFormats = computed(() => {
    const formats = trackLyricFormats(activeTrack.value);
    return formats.filter((format, index) => format && formats.indexOf(format) === index);
  });

  const activeLyricFormat = computed(() => {
    const lyrics = normalizeTrackLyrics(activeTrack.value);
    return lyrics?.defaultFormat ?? activeLyricFormats.value[0] ?? null;
  });

  function lyricsTrackKey(track: Track | null) {
    if (!track) return null;
    const providerId = track.sourceProviderId?.trim();
    const sourceId = track.sourceId?.trim();
    if (providerId && sourceId) return `plugin:${providerId}:${sourceId}`;
    return `${track.id}:${track.path}`;
  }

  function hasTrackSourceLyrics(track: Track | null) {
    return Boolean(track?.lyrics?.lyrics.length);
  }

  function setLyricsViewState(track: Track | null, status: LyricsViewStatus, error: string | null = null) {
    lyricsViewState.value = {
      trackKey: lyricsTrackKey(track),
      status,
      error,
    };
  }

  function syncLyricsViewStateForTrack(track: Track | null) {
    if (!track) {
      setLyricsViewState(null, 'idle');
      return;
    }
    if (normalizeTrackLyrics(track)?.lyrics.length) {
      setLyricsViewState(track, 'ready');
      return;
    }
    setLyricsViewState(track, 'loading');
  }

  function updateLyricsViewStateForRequest(track: Track, status: LyricsViewStatus, error: string | null = null) {
    if (lyricsViewState.value.trackKey !== lyricsTrackKey(track)) return;
    setLyricsViewState(track, status, error);
  }

  return {
    activeLyricFormat,
    activeLyricFormats,
    activeLyricsViewStatus,
    hasTrackSourceLyrics,
    lyricsTrackKey,
    lyricsViewState,
    setLyricsViewState,
    syncLyricsViewStateForTrack,
    updateLyricsViewStateForRequest,
  };
}
