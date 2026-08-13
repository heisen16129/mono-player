import type { ComponentPublicInstance } from 'vue';
import type { Track } from './music';

export type TrackTableRowClass = (track: Track) => string | Record<string, boolean> | null | undefined;
export type TrackTableTrackKey = (track: Track) => string | number;
export type TrackTableFavoriteMatcher = (track: Track) => boolean;

export interface TrackTableProps {
  activeTrack: Track | null;
  disableInternalPaging?: boolean;
  downloadedTrackKeys?: string[];
  pendingDownloadTrackKeys?: string[];
  enableDownloadAction?: boolean;
  enableArtistLinks?: boolean;
  extraColumns?: string;
  hideActionHeader?: boolean;
  hideActionsColumn?: boolean;
  enableContextMenu?: boolean;
  favoriteTrackIds: number[];
  isFavoriteTrack?: TrackTableFavoriteMatcher;
  isPlaying: boolean;
  label: string;
  highlightClass?: string;
  preparingTrackId?: number | null;
  recent?: boolean;
  tracks: Track[];
  scrollable?: boolean;
  showFavoriteAction?: boolean;
  wide?: boolean;
  rowClass?: TrackTableRowClass;
  trackKey?: TrackTableTrackKey;
}

export interface TrackTableSlots {
  extraHead?: () => unknown;
  extraCells?: (props: { track: Track; index: number }) => unknown;
}

export interface TrackTableEmits {
  openArtist: [artistName: string];
  openTrackMenu: [track: Track, x: number, y: number];
  downloadTrack: [track: Track];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface TrackTableHeaderProps {
  albumLabel: string;
  artistLabel: string;
  enableDownloadAction?: boolean;
  hideActionHeader?: boolean;
  hideActionsColumn?: boolean;
  showFavoriteAction?: boolean;
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  titleLabel: string;
}

export interface TrackTableHeaderSlots {
  extraHead?: () => unknown;
}

export interface TrackTableRowProps {
  active: boolean;
  canDownload: boolean;
  downloadActionLabel: string;
  enableArtistLinks?: boolean;
  enableDownloadAction?: boolean;
  extraColumns?: string;
  hideActionsColumn?: boolean;
  index: number;
  isDownloaded: boolean;
  isFavorite: boolean;
  isPendingDownload: boolean;
  isPlaying: boolean;
  localMusicLabel: string;
  preparing: boolean;
  rowClass?: TrackTableRowClass;
  setRowRef: (element: Element | ComponentPublicInstance | null) => void;
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  showFavoriteAction: boolean;
  toggleFavoriteLabel: string;
  track: Track;
  unknownArtistLabel: string;
}

export interface TrackTableRowSlots {
  extraCells?: (props: { track: Track; index: number }) => unknown;
}

export interface TrackTableRowEmits {
  click: [event: MouseEvent, track: Track];
  contextMenu: [event: MouseEvent, track: Track];
  downloadTrack: [track: Track];
  openArtist: [artistName: string];
  toggleFavorite: [track: Track];
}

export interface TrackTableRowListeners {
  onClick: (...args: TrackTableRowEmits['click']) => void;
  onContextMenu: (...args: TrackTableRowEmits['contextMenu']) => void;
  onDownloadTrack: (...args: TrackTableRowEmits['downloadTrack']) => void;
  onOpenArtist: (...args: TrackTableRowEmits['openArtist']) => void;
  onToggleFavorite: (...args: TrackTableRowEmits['toggleFavorite']) => void;
}

export interface TrackRowActionsProps {
  canDownload: boolean;
  downloadActionLabel: string;
  enableDownloadAction?: boolean;
  isDownloaded: boolean;
  isFavorite: boolean;
  isPendingDownload: boolean;
  showFavoriteAction: boolean;
  toggleFavoriteLabel: string;
  track: Track;
}

export interface TrackRowActionsEmits {
  downloadTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface TrackRowActionsListeners {
  onDownloadTrack: (...args: TrackRowActionsEmits['downloadTrack']) => void;
  onToggleFavorite: (...args: TrackRowActionsEmits['toggleFavorite']) => void;
}
