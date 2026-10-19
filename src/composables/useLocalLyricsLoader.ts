import { computed, watch } from 'vue';
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
  onlineActiveTrack: ReadonlyRefValue<Track | null>;
  isRemoteTrack: (track: Track) => boolean;
  applyLocalTrackLyrics: (track: Track, lyrics: TrackLyrics | null) => void;
  updateLyricsViewStateForRequest: (track: Track, status: LyricsViewStatus, error?: string | null) => void;
}

export function useLocalLyricsLoader({
  activeTrack,
  onlineActiveTrack,
  isRemoteTrack,
  applyLocalTrackLyrics,
  updateLyricsViewStateForRequest,
}: UseLocalLyricsLoaderOptions) {
  const localLyricsRequests = new Map<string, Promise<TrackLyrics | null>>();
  let requestId = 0;

  const playbackLyricMetadata = computed(() => normalizeTrackLyrics(activeTrack.value));

  function localLyricsRequestKey(track: Track) {
    return normalizePath(track.path);
  }

  function requestLocalTrackLyrics(track: Track) {
    const key = localLyricsRequestKey(track);
    const existing = localLyricsRequests.get(key);
    if (existing) return existing;

    const request = resolveLocalTrackLyrics(track)
      .finally(() => {
        if (localLyricsRequests.get(key) === request) localLyricsRequests.delete(key);
      });
    localLyricsRequests.set(key, request);
    return request;
  }

  async function loadLocalTrackLyricsInBackground(track: Track) {
    const currentRequest = ++requestId;
    const isCurrent = () => currentRequest === requestId
      && activeTrack.value?.id === track.id
      && normalizePath(activeTrack.value?.path ?? '') === normalizePath(track.path);
    if (isCurrent()) applyLocalTrackLyrics(track, null);
    try {
      const lyrics = await requestLocalTrackLyrics(track);
      if (!isCurrent()) return;
      applyLocalTrackLyrics(track, lyrics);
      if (!lyrics?.lyrics.length) {
        updateLyricsViewStateForRequest(track, 'empty');
        return;
      }
      updateLyricsViewStateForRequest(track, 'ready');
    } catch (error) {
      if (!isCurrent()) return;
      updateLyricsViewStateForRequest(track, 'empty');
      console.warn('[local-lyrics] background lyrics load failed', {
        path: track.path,
        title: track.title,
        error,
      });
    }
  }

  watch(
    () => `${activeTrack.value?.id}:${activeTrack.value?.path}:${Boolean(onlineActiveTrack.value)}`,
    () => {
      requestId += 1;
      localLyricsRequests.clear();
      const track = activeTrack.value;
      if (!track || onlineActiveTrack.value || isRemoteTrack(track)) return;
      void loadLocalTrackLyricsInBackground(track);
    },
    { immediate: true, flush: 'sync' },
  );

  return {
    loadLocalTrackLyricsInBackground,
    playbackLyricMetadata,
  };
}
