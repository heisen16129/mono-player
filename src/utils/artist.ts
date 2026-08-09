export type TrackArtistValue = string | string[] | null | undefined;

function splitArtistText(value: string) {
  return value
    .split(/[\/,&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function artistNames(value: TrackArtistValue): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(splitArtistText);
  }

  const name = value?.trim();
  return name ? splitArtistText(name) : [];
}

export function artistLabel(value: TrackArtistValue, fallback: string) {
  const names = artistNames(value);
  return names.length > 0 ? names.join(' & ') : fallback;
}
