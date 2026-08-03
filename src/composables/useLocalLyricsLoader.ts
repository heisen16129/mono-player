import { computed, ref, watch } from 'vue';
import { resolveLocalTrackLyrics } from '../services/music';
import type { Track, TrackLyrics } from '../types/music';
import { normalizePath } from '../utils/path';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

type LyricsViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseLocalLyricsLoaderOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  knownTracks: ReadonlyRefValue<(Track | null | undefined)[]>;
  onlineActiveTrack: ReadonlyRefValue<Track | null>;
  isRemoteTrack: (track: Track) => boolean;
  applyLocalTrackLyrics: (track: Track, lyrics: TrackLyrics) => void;
  updateLyricsViewStateForRequest: (track: Track, status: LyricsViewStatus, error?: string | null) => void;
}

export function useLocalLyricsLoader({
  activeTrack,
  knownTracks,
  onlineActiveTrack,
  isRemoteTrack,
  applyLocalTrackLyrics,
  updateLyricsViewStateForRequest,
}: UseLocalLyricsLoaderOptions) {
  const localLyricsRequests = new Map<string, Promise<TrackLyrics | null>>();
  const localLyricsMetadataByKey = ref(new Map<string, TrackLyrics>());

  const playbackLyricMetadata = computed(() => {
    const active = activeTrack.value;
    const lyrics = normalizeTrackLyrics(active);
    if (lyrics) return lyrics;
    if (!active || isRemoteTrack(active)) return null;
    return localLyricsMetadataByKey.value.get(localLyricsRequestKey(active)) ?? null;
  });

  function localLyricsRequestKey(track: Track) {
    return normalizePath(track.path);
  }

  function cacheLocalTrackLyrics(track: Track, lyrics: TrackLyrics) {
    const nextCache = new Map(localLyricsMetadataByKey.value);
    nextCache.set(localLyricsRequestKey(track), lyrics);
    localLyricsMetadataByKey.value = nextCache;
  }

  function findKnownTrackLyrics(track: Track) {
    const candidates = knownTracks.value.filter((item): item is Track => Boolean(item));
    const existing = candidates.find((item) => item.id === track.id || normalizePath(item.path) === normalizePath(track.path));
    const lyrics = normalizeTrackLyrics(existing);
    return lyrics?.lyrics.length ? lyrics : null;
  }

  function requestLocalTrackLyrics(track: Track) {
    const key = localLyricsRequestKey(track);
    const existing = localLyricsRequests.get(key);
    if (existing) return existing;

    const request = resolveLocalTrackLyrics(track)
      .finally(() => {
        localLyricsRequests.delete(key);
      });
    localLyricsRequests.set(key, request);
    return request;
  }

  async function loadLocalTrackLyricsInBackground(track: Track) {
    const knownLyrics = findKnownTrackLyrics(track);
    if (knownLyrics) {
      cacheLocalTrackLyrics(track, knownLyrics);
      applyLocalTrackLyrics(track, knownLyrics);
      updateLyricsViewStateForRequest(track, 'ready');
      return;
    }

    try {
      const lyrics = await requestLocalTrackLyrics(track);
      if (!lyrics?.lyrics.length) {
        updateLyricsViewStateForRequest(track, 'empty');
        return;
      }
      cacheLocalTrackLyrics(track, lyrics);
      applyLocalTrackLyrics(track, lyrics);
      updateLyricsViewStateForRequest(track, 'ready');
    } catch (error) {
      updateLyricsViewStateForRequest(track, 'empty');
      console.warn('[local-lyrics] background lyrics load failed', {
        path: track.path,
        title: track.title,
        error,
      });
    }
  }

  watch(
    () => [activeTrack.value?.id, activeTrack.value?.path, Boolean(onlineActiveTrack.value)] as const,
    ([, , isOnlineTrack]) => {
      const track = activeTrack.value;
      if (!track || isOnlineTrack || isRemoteTrack(track)) return;
      void loadLocalTrackLyricsInBackground(track);
    },
    { immediate: true },
  );

  return {
    loadLocalTrackLyricsInBackground,
    playbackLyricMetadata,
  };
}
