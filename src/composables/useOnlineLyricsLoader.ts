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
  hasTrackSourceLyrics: (track: Track | null) => boolean;
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
  hasTrackSourceLyrics,
  loadLocalTrackLyricsInBackground,
  updateActiveTrackSourceLyrics,
  updateLyricsViewStateForRequest,
}: UseOnlineLyricsLoaderOptions) {
  const onlineLyricsRequests = new Map<string, Promise<void>>();

  async function loadOnlineTrackLyricsInBackground(track: PluginSearchTrack, playbackTrack: Track) {
    const trackKey = getOnlineTrackKey(track);
    if (hasTrackSourceLyrics(playbackTrack)) {
      updateLyricsViewStateForRequest(playbackTrack, 'ready');
      return;
    }
    const existing = onlineLyricsRequests.get(trackKey);
    if (existing) return existing;

    const request = (async () => {
      try {
        const lyrics = await getPluginLyricsMetadata(track, {
          providerId: track.providerId,
          sourceId: track.id,
        });
        if (!lyrics.lyrics.length || onlineActiveTrackKey.value !== trackKey || activeTrack.value?.id !== playbackTrack.id) {
          if (onlineActiveTrackKey.value === trackKey && activeTrack.value?.id === playbackTrack.id) {
            updateLyricsViewStateForRequest(playbackTrack, 'empty');
          }
          return;
        }
        updateActiveTrackSourceLyrics(
          lyrics,
          playbackTrack.artwork ?? track.artwork ?? null,
          track.providerName,
          track.providerId,
          track.id,
          track.sourceRaw ?? track,
        );
        updateLyricsViewStateForRequest(playbackTrack, 'ready');
      } catch (error) {
        if (isPlaybackRequestReplacedError(error)) return;
        updateLyricsViewStateForRequest(playbackTrack, 'empty');
        console.warn('[plugin-lyrics] background lyrics load failed', {
          providerId: track.providerId,
          providerName: track.providerName,
          trackId: track.id,
          title: track.title,
          error,
        });
      } finally {
        onlineLyricsRequests.delete(trackKey);
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
