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
  const settledEmptyLyricsStateByKey = new Map<string, { status: 'empty' | 'error'; error: string | null }>();

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
    const trackKey = lyricsTrackKey(track);
    if (trackKey && status === 'loading') {
      const settledState = settledEmptyLyricsStateByKey.get(trackKey);
      if (settledState) {
        lyricsViewState.value = {
          trackKey,
          status: settledState.status,
          error: settledState.error,
        };
        return;
      }
    }
    if (trackKey && (status === 'empty' || status === 'error')) {
      settledEmptyLyricsStateByKey.set(trackKey, { status, error });
    }
    if (trackKey && status === 'ready') {
      settledEmptyLyricsStateByKey.delete(trackKey);
    }
    lyricsViewState.value = {
      trackKey,
      status,
      error,
    };
  }

  function syncLyricsViewStateForTrack(track: Track | null) {
    if (!track) {
      setLyricsViewState(null, 'idle');
      return;
    }
    const trackKey = lyricsTrackKey(track);
    if (normalizeTrackLyrics(track)?.lyrics.length) {
      setLyricsViewState(track, 'ready');
      return;
    }
    const settledState = trackKey ? settledEmptyLyricsStateByKey.get(trackKey) : null;
    if (settledState) {
      setLyricsViewState(track, settledState.status, settledState.error);
      return;
    }
    if (
      lyricsViewState.value.trackKey === trackKey
      && (lyricsViewState.value.status === 'empty' || lyricsViewState.value.status === 'error')
    ) {
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
