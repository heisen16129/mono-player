import type { Track, TrackLyrics } from '../types/music';

export function normalizeTrackLyrics(track?: Track | null): TrackLyrics | null {
  if (!track) return null;
  const lyrics = track.associatedLyrics ?? track.lyrics ?? null;
  if (lyrics) {
    return {
      rawLyrics: lyrics.rawLyrics ?? null,
      lyricsUrl: lyrics.lyricsUrl ?? null,
      formats: lyrics.formats ?? [],
      defaultFormat: lyrics.defaultFormat ?? null,
      format: lyrics.format ?? lyrics.defaultFormat ?? null,
      providerId: lyrics.providerId ?? null,
      providerName: lyrics.providerName ?? null,
      trackId: lyrics.trackId ?? null,
      trackRaw: lyrics.trackRaw,
    };
  }

  if (
    !track.rawLyrics
    && !track.lyricsSourceUrl
    && !track.lyricsFormats?.length
    && !track.lyricsProviderId
    && !track.lyricsTrackId
  ) {
    return null;
  }

  return {
    rawLyrics: track.rawLyrics ?? null,
    lyricsUrl: track.lyricsSourceUrl ?? null,
    formats: track.lyricsFormats ?? [],
    defaultFormat: track.lyricsDefaultFormat ?? null,
    format: track.lyricsFormat ?? track.lyricsDefaultFormat ?? null,
    providerId: track.lyricsProviderId ?? null,
    providerName: track.lyricsSourceName ?? null,
    trackId: track.lyricsTrackId ?? null,
    trackRaw: track.lyricsTrackRaw,
  };
}

export function trackRawLyrics(track?: Track | null) {
  return normalizeTrackLyrics(track)?.rawLyrics ?? null;
}
