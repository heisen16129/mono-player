import type { LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { Track } from './music';

export interface WorkspaceViewProps {
  activeCollection: LibraryCollection;
  activePlaylistId: string | null;
  activeTrack: Track | null;
  error: string | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  preparingTrackId?: number | null;
  libraryFilter: LibraryFilter;
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  isPlaylistView?: boolean;
  modelValue: string;
  tracks: Track[];
}

export interface WorkspaceViewEmits {
  changePlaylistCover: [playlistId: string];
  openArtist: [artistName: string];
  openTrackMenu: [track: Track, x: number, y: number];
  playFavoriteTracks: [];
  playVisibleTracks: [];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
  'update:modelValue': [value: string];
}

export interface WorkspaceViewListeners {
  onChangePlaylistCover: (...args: WorkspaceViewEmits['changePlaylistCover']) => void;
  onOpenArtist: (...args: WorkspaceViewEmits['openArtist']) => void;
  onOpenTrackMenu: (...args: WorkspaceViewEmits['openTrackMenu']) => void;
  onPlayFavoriteTracks: (...args: WorkspaceViewEmits['playFavoriteTracks']) => void;
  onPlayVisibleTracks: (...args: WorkspaceViewEmits['playVisibleTracks']) => void;
  onPlayTrack: (...args: WorkspaceViewEmits['playTrack']) => void;
  onSelectTrack: (...args: WorkspaceViewEmits['selectTrack']) => void;
  onToggleFavorite: (...args: WorkspaceViewEmits['toggleFavorite']) => void;
  'onUpdate:modelValue': (...args: WorkspaceViewEmits['update:modelValue']) => void;
}

export interface WorkspaceTrackListProps {
  activeTrack: Track | null;
  emptyMessage: string;
  error: string | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  isWideCollection: boolean;
  preparingTrackId: number | null;
  tracks: Track[];
}

export interface WorkspaceTrackListEmits {
  openArtist: [artistName: string];
  openTrackMenu: [track: Track, x: number, y: number];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface WorkspaceTrackListListeners {
  onOpenArtist: (...args: WorkspaceTrackListEmits['openArtist']) => void;
  onOpenTrackMenu: (...args: WorkspaceTrackListEmits['openTrackMenu']) => void;
  onPlayTrack: (...args: WorkspaceTrackListEmits['playTrack']) => void;
  onSelectTrack: (...args: WorkspaceTrackListEmits['selectTrack']) => void;
  onToggleFavorite: (...args: WorkspaceTrackListEmits['toggleFavorite']) => void;
}
