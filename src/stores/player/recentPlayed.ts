const MAX_RECENT_PLAYED_TRACKS = 100;

export function normalizeRecentPlayedTrackIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is number => Number.isSafeInteger(id)))]
    .slice(0, MAX_RECENT_PLAYED_TRACKS);
}
