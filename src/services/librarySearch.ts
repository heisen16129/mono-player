import { invokeApi } from './api';
import type { Track, TrackStatistics } from '../types/music';

export interface LibraryListStatistics {
  tracks: TrackStatistics;
  latestAddedTracks: TrackStatistics;
  recentPlayedTracks: TrackStatistics;
}

export interface LibrarySearchResult {
  statistics: LibraryListStatistics;
  totals: LibraryListStatistics;
  tracks: Track[];
  latestAddedTracks: Track[];
  recentPlayedTracks: Track[];
}

export function searchLibrary(query: string) {
  return invokeApi<LibrarySearchResult>('search_library', { query });
}
