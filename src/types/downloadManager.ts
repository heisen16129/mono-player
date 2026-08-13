import type { DownloadItem, Track } from './music';

export interface DownloadItemContextMenuState {
  item: DownloadItem;
  x: number;
  y: number;
}

export interface DownloadItemContextMenuProps {
  menu: DownloadItemContextMenuState;
}

export interface DownloadItemContextMenuEmits {
  addToPlaylist: [item: DownloadItem];
  clearRecord: [item: DownloadItem];
  deleteDownload: [item: DownloadItem];
  openFolder: [item: DownloadItem];
  pauseDownload: [item: DownloadItem];
  queueNext: [item: DownloadItem];
  resumeDownload: [item: DownloadItem];
  retryDownload: [item: DownloadItem];
}

export interface DownloadItemContextMenuListeners {
  onAddToPlaylist: (...args: DownloadItemContextMenuEmits['addToPlaylist']) => void;
  onClearRecord: (...args: DownloadItemContextMenuEmits['clearRecord']) => void;
  onDeleteDownload: (...args: DownloadItemContextMenuEmits['deleteDownload']) => void;
  onOpenFolder: (...args: DownloadItemContextMenuEmits['openFolder']) => void;
  onPauseDownload: (...args: DownloadItemContextMenuEmits['pauseDownload']) => void;
  onQueueNext: (...args: DownloadItemContextMenuEmits['queueNext']) => void;
  onResumeDownload: (...args: DownloadItemContextMenuEmits['resumeDownload']) => void;
  onRetryDownload: (...args: DownloadItemContextMenuEmits['retryDownload']) => void;
}

export interface DownloadManagerViewProps {
  activeTrack: Track | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  items: DownloadItem[];
}

export interface DownloadManagerViewEmits extends DownloadItemContextMenuEmits {
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface DownloadManagerViewListeners extends DownloadItemContextMenuListeners {
  onPlayTrack: (...args: DownloadManagerViewEmits['playTrack']) => void;
  onSelectTrack: (...args: DownloadManagerViewEmits['selectTrack']) => void;
  onToggleFavorite: (...args: DownloadManagerViewEmits['toggleFavorite']) => void;
}

export interface DownloadManagerContentProps {
  activeTrack: Track | null;
  downloadItemForTrack: (track: Track) => DownloadItem | null;
  emptyMessage: string;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  rowClass: (track: Track) => Record<string, boolean>;
  showFavoriteAction: boolean;
  tracks: Track[];
}

export interface DownloadManagerContentEmits {
  openTrackMenu: [track: Track, x: number, y: number];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface DownloadManagerContentListeners {
  onOpenTrackMenu: (...args: DownloadManagerContentEmits['openTrackMenu']) => void;
  onPlayTrack: (...args: DownloadManagerContentEmits['playTrack']) => void;
  onSelectTrack: (...args: DownloadManagerContentEmits['selectTrack']) => void;
  onToggleFavorite: (...args: DownloadManagerContentEmits['toggleFavorite']) => void;
}
