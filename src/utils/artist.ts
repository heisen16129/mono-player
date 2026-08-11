export type TrackArtistValue = string | string[] | null | undefined;

const ARTIST_TEXT_SEPARATOR_RE = /\s*(?:&|\/|,|，|、|;|；|_)\s*/;

export function splitArtistText(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(ARTIST_TEXT_SEPARATOR_RE)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function artistNames(value: TrackArtistValue): string[] {
  if (Array.isArray(value)) {
    return value.map((name) => name.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return splitArtistText(value);
  }

  return [];
}

export function artistLabel(value: TrackArtistValue, fallback: string) {
  const names = artistNames(value);
  return names.length > 0 ? names.join(' & ') : fallback;
}
