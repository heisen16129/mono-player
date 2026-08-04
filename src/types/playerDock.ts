import type { Locale, PlaybackMode, PlayerSettings, Track } from './music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from './plugin';

export interface PlayerDockProps {
  activeTrack: Track | null;
  canControlPlayback: boolean;
  lyricsOpen: boolean;
  isFavorite: boolean;
  onlineQuality: PluginPlaybackQuality;
  onlineQualityOptions: PluginPlaybackQualityOption[];
  lyricFormat: string | null;
  lyricFormats: string[];
  playbackMode: PlaybackMode;
  playbackModeLabel: string;
  queue: Track[];
  restoreRequestId: number;
  restoreTime: number;
  seekRequestId: number;
  seekTime: number;
  isPreparingActiveTrack: boolean;
  showActiveTrackDownload: boolean;
  isActiveTrackDownloaded: boolean;
  isActiveTrackDownloading: boolean;
  showOnlineQuality: boolean;
  showLyricFormat: boolean;
  togglePlaybackRequestId: number;
}

export interface PlayerDockEmits {
  mouseenter: [];
  mouseleave: [];
  openDesktopLyrics: [];
  openLyrics: [];
  toggleDesktopLyrics: [];
  onlineQualityChange: [quality: PluginPlaybackQuality];
  lyricFormatChange: [format: string];
  downloadActiveTrack: [];
  playNext: [];
  playPrevious: [];
  timeChange: [value: number];
  toggleFavorite: [];
  togglePlaybackMode: [];
  playQueueTrack: [track: Track];
  seamlessAdvance: [track: Track];
  requestInitialPlayback: [startTime?: number];
  playbackStateChange: [isPlaying: boolean];
  playbackError: [message: string];
  spectrumChange: [levels: number[]];
}

export interface PlayerDockListeners {
  onMouseenter: () => void;
  onMouseleave: () => void;
  onDownloadActiveTrack: () => void;
  onOpenDesktopLyrics: () => void;
  onOpenLyrics: () => void;
  onToggleDesktopLyrics: () => void;
  onLyricFormatChange: (...args: PlayerDockEmits['lyricFormatChange']) => void;
  onOnlineQualityChange: (...args: PlayerDockEmits['onlineQualityChange']) => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  onPlayQueueTrack: (...args: PlayerDockEmits['playQueueTrack']) => void;
  onPlaybackError: (...args: PlayerDockEmits['playbackError']) => void;
  onPlaybackStateChange: (...args: PlayerDockEmits['playbackStateChange']) => void;
  onSpectrumChange: (...args: PlayerDockEmits['spectrumChange']) => void;
  onRequestInitialPlayback: (...args: PlayerDockEmits['requestInitialPlayback']) => void;
  onSeamlessAdvance: (...args: PlayerDockEmits['seamlessAdvance']) => void;
  onTimeChange: (...args: PlayerDockEmits['timeChange']) => void;
  onToggleFavorite: () => void;
  onTogglePlaybackMode: () => void;
}

export interface PlaybackMetaControlProps {
  activeTrack: Track | null;
  isActiveTrackDownloaded: boolean;
  isActiveTrackDownloading: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  isPreparingActiveTrack: boolean;
  isQueueOpen: boolean;
  locale: Locale;
  lyricFormat: string | null;
  lyricFormatLabel: string;
  lyricFormats: string[];
  onlineQuality: PluginPlaybackQuality;
  onlineQualityLabel: string;
  onlineQualityOptions: PluginPlaybackQualityOption[];
  playbackRate: number;
  playbackRateLabel: string;
  queueTracks: Track[];
  showActiveTrackDownload: boolean;
  showLyricFormat: boolean;
  showOnlineQuality: boolean;
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
  sleepTimerAction: PlayerSettings['sleepTimerAction'];
  sleepTimerExecuteAtLabel: string;
  sleepTimerHours: number;
  isSleepTimerActive: boolean;
  isSleepTimerDialogOpen: boolean;
  isSleepTimerPaused: boolean;
  isSleepTimerStatusOpen: boolean;
  sleepTimerMinutes: number;
  sleepTimerPresetMinutes: readonly number[];
  sleepTimerProgressPercent: number;
  sleepTimerRemainingLabel: string;
  spectrumLevels: number[];
  volume: number;
}

export interface NowPlayingInfoProps {
  activeTrack: Track | null;
  coverUrl: string;
  currentTime: number;
  locale: Locale;
  lyricsOpen: boolean;
  totalDurationLabel: string;
}

export interface TransportControlProps {
  activeTrack: Track | null;
  isFavorite: boolean;
  isPlaying: boolean;
  locale: Locale;
  playbackMode: PlaybackMode;
  playbackModeLabel: string;
}
