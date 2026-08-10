import type { Ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track, TrackLyrics } from '../types/music';
import { normalizeTrackLyrics } from '../utils/trackLyrics';
import { isSameTrackForMetadata } from '../utils/trackRuntimeMetadata';

type LyricsTarget = 'lyrics' | 'associatedLyrics';
type LyricsViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseTrackLyricsMutationOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  currentPlaybackTrack: Ref<Track | null>;
  onlineActiveTrack: Ref<Track | null>;
  player: ReturnType<typeof usePlayerStore>;
  rustPlaybackQueue: Ref<Track[]>;
  selectedTrack: Ref<Track | null>;
  updateLyricsViewStateForRequest: (track: Track, status: LyricsViewStatus, error?: string | null) => void;
}

export function useTrackLyricsMutation({
  activeTrack,
  currentPlaybackTrack,
  onlineActiveTrack,
  player,
  rustPlaybackQueue,
  selectedTrack,
  updateLyricsViewStateForRequest,
}: UseTrackLyricsMutationOptions) {
  function withTrackLyrics(
    track: Track,
    target: LyricsTarget,
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    lyricsProviderId?: string | null,
    lyricsTrackId?: string | null,
    lyricsTrackRaw?: unknown,
  ): Track {
    const nextArtwork = artwork?.trim() || null;
    const previousLyrics = target === 'lyrics'
      ? track.lyrics ?? null
      : track.associatedLyrics ?? track.lyrics ?? null;
    const nextLyrics: TrackLyrics = {
      providerId: lyricsProviderId ?? previousLyrics?.providerId ?? null,
      providerName: sourceName ?? previousLyrics?.providerName ?? null,
      trackId: lyricsTrackId ?? previousLyrics?.trackId ?? null,
      defaultFormat: lyrics.defaultFormat ?? previousLyrics?.defaultFormat ?? lyrics.lyrics[0]?.format ?? null,
      lyrics: lyrics.lyrics,
      trackRaw: lyricsTrackRaw ?? previousLyrics?.trackRaw,
    };
    return {
      ...track,
      [target]: nextLyrics,
      ...(target === 'associatedLyrics'
        ? { associatedArtwork: nextArtwork ?? track.associatedArtwork ?? null }
        : { artwork: nextArtwork ?? track.artwork ?? null }),
    };
  }

  function updateTrackLyricsState(
    target: LyricsTarget,
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    lyricsProviderId?: string | null,
    lyricsTrackId?: string | null,
    lyricsTrackRaw?: unknown,
  ) {
    const active = activeTrack.value;
    if (!active) return;

    const nextTrack = withTrackLyrics(active, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
    if (isSameTrackForMetadata(onlineActiveTrack.value, active)) {
      onlineActiveTrack.value = nextTrack;
    }
    if (isSameTrackForMetadata(selectedTrack.value, active)) {
      selectedTrack.value = nextTrack;
    }
    if (isSameTrackForMetadata(currentPlaybackTrack.value, active)) {
      currentPlaybackTrack.value = nextTrack;
    }
    if (isSameTrackForMetadata(player.currentTrack, active)) {
      player.setCurrentTrack(nextTrack);
    }
    updateLyricsViewStateForRequest(nextTrack, 'ready');

    player.tracks = player.tracks.map((track) => (isSameTrackForMetadata(track, active) ? withTrackLyrics(track, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
    player.queue = player.queue.map((track) => (isSameTrackForMetadata(track, active) ? withTrackLyrics(track, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
    rustPlaybackQueue.value = rustPlaybackQueue.value.map((track) => (isSameTrackForMetadata(track, active) ? withTrackLyrics(track, target, lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw) : track));
  }

  function updateActiveTrackSourceLyrics(
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    lyricsProviderId?: string | null,
    lyricsTrackId?: string | null,
    lyricsTrackRaw?: unknown,
  ) {
    updateTrackLyricsState('lyrics', lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
  }

  function updateActiveTrackLyrics(
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    lyricsProviderId?: string | null,
    lyricsTrackId?: string | null,
    lyricsTrackRaw?: unknown,
  ) {
    updateTrackLyricsState('associatedLyrics', lyrics, artwork, sourceName, lyricsProviderId, lyricsTrackId, lyricsTrackRaw);
  }

  function withoutAssociatedTrackLyrics(track: Track): Track {
    return {
      ...track,
      associatedLyrics: null,
      associatedArtwork: null,
    };
  }

  function clearActiveTrackLyrics() {
    const active = activeTrack.value;
    if (!active) return;

    const nextTrack = withoutAssociatedTrackLyrics(active);
    if (isSameTrackForMetadata(onlineActiveTrack.value, active)) {
      onlineActiveTrack.value = nextTrack;
    }
    if (isSameTrackForMetadata(selectedTrack.value, active)) {
      selectedTrack.value = nextTrack;
    }
    if (isSameTrackForMetadata(currentPlaybackTrack.value, active)) {
      currentPlaybackTrack.value = nextTrack;
    }
    if (isSameTrackForMetadata(player.currentTrack, active)) {
      player.setCurrentTrack(nextTrack);
    }
    updateLyricsViewStateForRequest(nextTrack, normalizeTrackLyrics(nextTrack)?.lyrics.length ? 'ready' : 'empty');

    player.tracks = player.tracks.map((track) => (isSameTrackForMetadata(track, active) ? withoutAssociatedTrackLyrics(track) : track));
    player.queue = player.queue.map((track) => (isSameTrackForMetadata(track, active) ? withoutAssociatedTrackLyrics(track) : track));
    rustPlaybackQueue.value = rustPlaybackQueue.value.map((track) => (isSameTrackForMetadata(track, active) ? withoutAssociatedTrackLyrics(track) : track));
  }

  return {
    clearActiveTrackLyrics,
    updateActiveTrackLyrics,
    updateActiveTrackSourceLyrics,
  };
}
