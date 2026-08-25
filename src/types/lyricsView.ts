import type { Track, TrackLyrics } from './music';
import type { PlayerDockController } from './playerDockController';

export type LyricsViewStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface LyricsViewProps {
  activeTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  isFavorite: boolean;
  isOpen: boolean;
  isPlayerDockHidden: boolean;
  lyricFormat?: string | null;
  lyricsMetadata?: TrackLyrics | null;
  lyricsStatus?: LyricsViewStatus;
  lyricsError?: string | null;
  playerDockController?: PlayerDockController | null;
}

export interface LyricsViewEmits {
  close: [];
  coverChanged: [artwork?: string | null];
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
  openSettings: [];
  seek: [time: number];
  showPlayerDock: [];
  togglePlayback: [];
  playNext: [];
  playPrevious: [];
  toggleFavorite: [];
}

export interface LyricsViewListeners {
  onClose: () => void;
  onCoverChanged: (artwork?: string | null) => void;
  onLyricsCleared: () => void;
  onLyricsFound: (...args: LyricsViewEmits['lyricsFound']) => void;
  onNotify: (...args: LyricsViewEmits['notify']) => void;
  onOpenSettings: () => void;
  onHidePlayerDock: () => void;
  onShowPlayerDock: () => void;
  onSeek: (...args: LyricsViewEmits['seek']) => void;
  onTogglePlayback: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  onToggleFavorite: () => void;
}
