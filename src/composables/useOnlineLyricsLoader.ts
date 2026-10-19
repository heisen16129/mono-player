import { watch } from 'vue';
import { getPluginLyricsMetadata } from '../services/pluginSearch';
import type { Track, TrackLyrics } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { isPlaybackRequestReplacedError, isRemoteTrack } from '../utils/playback';

type LyricsViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseOnlineLyricsLoaderOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  onlineActiveTrackKey: ReadonlyRefValue<string | null>;
  getOnlineTrackKey: (track: PluginSearchTrack) => string;
  loadLocalTrackLyricsInBackground: (track: Track) => void;
  updateActiveTrackSourceLyrics: (
    lyrics: TrackLyrics,
    artwork: string | null,
    sourceName: string | null,
    lyricsProviderId: string,
    lyricsTrackId: string,
    lyricsTrackRaw: unknown,
  ) => void;
  updateLyricsViewStateForRequest: (track: Track, status: LyricsViewStatus, error?: string | null) => void;
}

export function useOnlineLyricsLoader({
  activeTrack,
  onlineActiveTrackKey,
  getOnlineTrackKey,
  loadLocalTrackLyricsInBackground,
  updateActiveTrackSourceLyrics,
  updateLyricsViewStateForRequest,
}: UseOnlineLyricsLoaderOptions) {
  const onlineLyricsRequests = new Map<string, Promise<void>>();
  let generation = 0;
  watch(
    () => `${onlineActiveTrackKey.value}:${activeTrack.value?.id}:${activeTrack.value?.path}`,
    () => { generation += 1; onlineLyricsRequests.clear(); },
    { flush: 'sync' },
  );

  async function loadOnlineTrackLyricsInBackground(track: PluginSearchTrack, playbackTrack: Track) {
    const trackKey = getOnlineTrackKey(track);
    const existing = onlineLyricsRequests.get(trackKey);
    if (existing) return existing;

    const requestGeneration = generation;
    const isCurrent = () => requestGeneration === generation
      && onlineActiveTrackKey.value === trackKey && activeTrack.value?.id === playbackTrack.id;
    if (isCurrent()) updateActiveTrackSourceLyrics(
      { lyrics: [] }, null, track.providerName, track.providerId, track.id, track.sourceRaw ?? track,
    );
    const request = (async () => {
      try {
        const lyrics = await getPluginLyricsMetadata(track, {
          providerId: track.providerId,
          sourceId: track.id,
        });
        if (!isCurrent()) return;
        updateActiveTrackSourceLyrics(
          lyrics,
          playbackTrack.artwork ?? track.artwork ?? null,
          track.providerName,
          track.providerId,
          track.id,
          track.sourceRaw ?? track,
        );
        updateLyricsViewStateForRequest(playbackTrack, lyrics.lyrics.length ? 'ready' : 'empty');
      } catch (error) {
        if (!isCurrent() || isPlaybackRequestReplacedError(error)) return;
        updateLyricsViewStateForRequest(playbackTrack, 'empty');
        console.warn('[plugin-lyrics] background lyrics load failed', {
          providerId: track.providerId,
          providerName: track.providerName,
          trackId: track.id,
          title: track.title,
          error,
        });
      } finally {
        if (requestGeneration === generation) onlineLyricsRequests.delete(trackKey);
      }
    })();

    onlineLyricsRequests.set(trackKey, request);
    return request;
  }

  function loadPlaybackTrackLyricsInBackground(track: PluginSearchTrack, playbackTrack: Track) {
    if (!isRemoteTrack(playbackTrack)) {
      void loadLocalTrackLyricsInBackground(playbackTrack);
      return;
    }
    void loadOnlineTrackLyricsInBackground(track, playbackTrack);
  }

  return {
    loadOnlineTrackLyricsInBackground,
    loadPlaybackTrackLyricsInBackground,
  };
}
