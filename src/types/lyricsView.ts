import type { LyricLine, Track, TrackLyrics } from './music';
import type { PluginSearchProvider, PluginSearchTrack } from './plugin';

export type LyricsViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface LyricsViewProps {
  activeTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  isOpen: boolean;
  isPlayerDockHidden: boolean;
  lyricFormat?: string | null;
  lyricsMetadata?: TrackLyrics | null;
  lyricsStatus?: LyricsViewStatus;
  lyricsError?: string | null;
}

export interface LyricsViewEmits {
  close: [];
  coverChanged: [];
  lyricsCleared: [];
  lyricsFound: [
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    providerId?: string | null,
    trackId?: string | null,
    trackRaw?: unknown,
  ];
  hidePlayerDock: [];
  notify: [message: string, variant?: 'success' | 'error'];
  seek: [time: number];
  showPlayerDock: [];
}

export interface LyricsViewListeners {
  onClose: () => void;
  onCoverChanged: () => void;
  onLyricsCleared: () => void;
  onLyricsFound: (...args: LyricsViewEmits['lyricsFound']) => void;
  onNotify: (...args: LyricsViewEmits['notify']) => void;
  onHidePlayerDock: () => void;
  onShowPlayerDock: () => void;
  onSeek: (...args: LyricsViewEmits['seek']) => void;
}

export interface LyricsStageProps {
  activeLyricIndex: number;
  coverUrl: string;
  emptyMessage: string;
  isEmpty: boolean;
  isLyricSyncOpen: boolean;
  isLyricsPending: boolean;
  isPlayerDockHidden: boolean;
  isScrolling: boolean;
  label: string;
  lines: LyricLine[];
  loadingText: string;
  lyricWordProgress: (line: LyricLine, lineIndex: number, wordIndex: number) => string;
  scrollThumbTop: number;
  setLyricsPanelRef: (instance: unknown) => void;
}

export interface LyricsActionMenuOverlayProps {
  downloadableLyricFormats: string[];
  fontSize: number;
  hasAssociatedLyrics: boolean;
  hasDownloadableCover: boolean;
  hasLinkedLyrics: boolean;
  isFullscreen: boolean;
  isLyricSyncOpen: boolean;
  isOpen: boolean;
  isPlayerDockHidden: boolean;
  left: number;
  linkedLyricsLabel: string;
  top: number;
}

export interface LyricsSearchTabItem {
  disabled?: boolean;
  id: string | null;
  label: string;
}

export interface LyricsSearchDialogOverlayProps {
  isLoadingMore: boolean;
  isOpen: boolean;
  isSearching: boolean;
  providerId: string | null;
  providers: PluginSearchProvider[];
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  status: string;
  tabItems: LyricsSearchTabItem[];
  trackKey: (track: PluginSearchTrack) => string;
}
