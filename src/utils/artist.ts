export type TrackArtistValue = string | string[] | null | undefined;

export function artistNames(value: TrackArtistValue): string[] {
  return Array.isArray(value)
    ? value.map((name) => name.trim()).filter(Boolean)
    : [];
}

export function artistLabel(value: TrackArtistValue, fallback: string) {
  const names = artistNames(value);
  return names.length > 0 ? names.join(' & ') : fallback;
}
