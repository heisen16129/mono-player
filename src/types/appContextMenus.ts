import type { Locale, Track, UserPlaylist } from './music';

export interface PlaylistContextMenuModel {
  playlist: UserPlaylist;
  x: number;
  y: number;
}

export interface TrackContextMenuModel {
  track: Track;
  x: number;
  y: number;
}

export interface PlaylistContextMenuProps {
  menu: PlaylistContextMenuModel;
  locale: Locale;
}

export interface PlaylistContextMenuEmits {
  rename: [playlist: UserPlaylist];
  delete: [playlist: UserPlaylist];
}

export interface PlaylistContextMenuListeners {
  onRename: (...args: PlaylistContextMenuEmits['rename']) => void;
  onDelete: (...args: PlaylistContextMenuEmits['delete']) => void;
}

export interface TrackContextMenuProps {
  activePlaylistId: string | null;
  canEditMetadata?: boolean;
  canChangeCover?: boolean;
  canRefreshDuration?: boolean;
  isDownloaded?: boolean;
  isFavorite: boolean;
  locale: Locale;
  menu: TrackContextMenuModel;
}

export interface TrackContextMenuEmits {
  queueNext: [track: Track];
  queueLast: [track: Track];
  addToFavorite: [track: Track];
  addToPlaylist: [track: Track];
  downloadTrack: [track: Track];
  editMetadata: [track: Track];
  changeCover: [track: Track];
  refreshDuration: [track: Track];
  removeFromPlaylist: [track: Track];
  openFolder: [track: Track];
}

export interface TrackContextMenuListeners {
  onQueueNext: (...args: TrackContextMenuEmits['queueNext']) => void;
  onQueueLast: (...args: TrackContextMenuEmits['queueLast']) => void;
  onAddToFavorite: (...args: TrackContextMenuEmits['addToFavorite']) => void;
  onAddToPlaylist: (...args: TrackContextMenuEmits['addToPlaylist']) => void;
  onDownloadTrack: (...args: TrackContextMenuEmits['downloadTrack']) => void;
  onEditMetadata: (...args: TrackContextMenuEmits['editMetadata']) => void;
  onChangeCover: (...args: TrackContextMenuEmits['changeCover']) => void;
  onRefreshDuration: (...args: TrackContextMenuEmits['refreshDuration']) => void;
  onRemoveFromPlaylist: (...args: TrackContextMenuEmits['removeFromPlaylist']) => void;
  onOpenFolder: (...args: TrackContextMenuEmits['openFolder']) => void;
}
