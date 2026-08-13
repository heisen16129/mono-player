import type { Track } from './music';
import type { OnlineSearchSnapshot } from './onlineSearch';
import type { PluginSearchProvider, PluginSearchTrack } from './plugin';

export interface DiscoverMusicPageProps {
  activePlaybackTrack: Track | null;
  activeTrackKey: string | null;
  downloadedTrackKeys: string[];
  favoriteTrackIds: number[];
  isPlaying: boolean;
  pendingDownloadTrackKeys: string[];
  resolvingTrackKey: string | null;
  searchHistory: string[];
  searchError: string | null;
}

export interface DiscoverMusicPageEmits {
  backLocal: [];
  downloadTrack: [track: Track];
  notify: [message: string, variant?: 'success' | 'error'];
  openTrackMenu: [track: PluginSearchTrack, x: number, y: number];
  playTrack: [track: PluginSearchTrack];
  searchReady: [snapshot: OnlineSearchSnapshot];
  searchStarted: [];
  searchUpdated: [snapshot: OnlineSearchSnapshot];
  toggleFavorite: [track: Track];
}

export interface PluginSearchViewProps {
  activeProviderId: string | null;
  activePlaybackTrack: Track | null;
  activeTrackKey: string | null;
  downloadedTrackKeys: string[];
  pendingDownloadTrackKeys: string[];
  error: string | null;
  favoriteTrackIds: number[];
  hasMore: boolean;
  isPlaying: boolean;
  loadMoreError: string | null;
  loading: boolean;
  loadingMore: boolean;
  providers: PluginSearchProvider[];
  query: string;
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  searchHistory: string[];
}
