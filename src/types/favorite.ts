import type { Track, TrackStatistics } from './music';

export interface Favorite {
  id: number;
  identityKey: string;
  track: Track;
}

export interface FavoriteList {
  items: Favorite[];
  statistics: TrackStatistics;
}
