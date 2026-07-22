import type { Track, TrackLyrics, TrackLyricVariant } from '../types/music';

function normalizeLyricVariants(variants?: TrackLyricVariant[] | null) {
  const nextVariants: TrackLyricVariant[] = [];
  for (const variant of variants ?? []) {
    const format = variant.format?.trim().toLowerCase();
    const content = variant.content?.trim();
    if (!format || !content || nextVariants.some((item) => item.format === format)) continue;
    nextVariants.push({
      format,
      content,
      sourceUrl: variant.sourceUrl ?? null,
      quality: variant.quality ?? null,
    });
  }
  return nextVariants;
}

function normalizeLyricsObject(lyrics?: TrackLyrics | null): TrackLyrics | null {
  if (!lyrics) return null;
  const variants = normalizeLyricVariants(lyrics.lyrics);
  if (!variants.length) return null;
  return {
    providerId: lyrics.providerId ?? null,
    providerName: lyrics.providerName ?? null,
    trackId: lyrics.trackId ?? null,
    defaultFormat: lyrics.defaultFormat ?? variants[0].format,
    lyrics: variants,
    trackRaw: lyrics.trackRaw,
  };
}

export function normalizeTrackLyrics(track?: Track | null): TrackLyrics | null {
  if (!track) return null;
  const lyrics = track.associatedLyrics ?? track.lyrics ?? null;
  return normalizeLyricsObject(lyrics);
}

export function trackLyricFormats(track?: Track | null) {
  return normalizeTrackLyrics(track)?.lyrics.map((variant) => variant.format) ?? [];
}

export function selectTrackLyricsVariant(lyrics?: TrackLyrics | null, preferredFormat?: string | null) {
  if (!lyrics?.lyrics.length) return null;
  const preferred = preferredFormat?.trim().toLowerCase() || lyrics.defaultFormat?.trim().toLowerCase() || '';
  return lyrics.lyrics.find((variant) => variant.format === preferred) ?? lyrics.lyrics[0];
}

export function selectTrackLyricVariant(track?: Track | null, preferredFormat?: string | null) {
  return selectTrackLyricsVariant(normalizeTrackLyrics(track), preferredFormat);
}

export function trackRawLyrics(track?: Track | null, preferredFormat?: string | null) {
  return selectTrackLyricVariant(track, preferredFormat)?.content ?? null;
}
