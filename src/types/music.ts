export interface TrackLyrics {
  rawLyrics?: string | null;
  lyricsUrl?: string | null;
  formats?: string[];
  defaultFormat?: string | null;
  format?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  trackId?: string | null;
  trackRaw?: unknown;
}

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  addedAt?: string | null;
  scanId?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  coverVersion?: number;
  artwork?: string | null;
  associatedArtwork?: string | null;
  lyrics?: TrackLyrics | null;
  associatedLyrics?: TrackLyrics | null;
  rawLyrics?: string | null;
  lyricsSourceName?: string | null;
  lyricsSourceUrl?: string | null;
  lyricsFormats?: string[];
  lyricsDefaultFormat?: string | null;
  lyricsFormat?: string | null;
  lyricsProviderId?: string | null;
  lyricsTrackId?: string | null;
  lyricsTrackRaw?: unknown;
  sourceId?: string | null;
  sourceName?: string | null;
  sourceProviderId?: string | null;
  sourceRaw?: unknown;
}

export interface DownloadItem {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  sourceName: string;
  sourceId: string;
  artwork?: string | null;
  status: 'downloading' | 'downloaded' | 'failed' | 'paused';
  progress: number;
  createdAt: number;
  downloadRequest?: {
    taskId?: string;
    downloadDir: string;
    track: Track;
    qualityFallback?: string | null;
  } | null;
  filePath?: string | null;
  lyricsPath?: string | null;
  error?: string | null;
}

export interface LyricLine {
  time: number | null;
  text: string;
  words?: LyricWord[];
}

export interface LyricWord {
  time: number;
  text: string;
}

export interface CoverImage {
  mime_type: string;
  data: number[];
}

export interface WallpaperThemeColor {
  r: number;
  g: number;
  b: number;
  path: string | null;
}

export interface SystemThemeState {
  mode: 'light' | 'dark';
  appsUseLightTheme: boolean;
  systemUsesLightTheme: boolean;
  wallpaperColor?: WallpaperThemeColor | null;
}

export type AppLocale = 'zh-CN' | 'en-US';
export type Locale = 'system' | AppLocale;
export type BuiltInTheme = 'dark' | 'light' | 'blueWhite' | 'wallpaperTone' | 'desktopGlass';
export type CustomThemeId = `custom:${string}`;
export type AppTheme = BuiltInTheme | CustomThemeId;

export interface CustomTheme {
  id: CustomThemeId;
  name: string;
  author: string;
  variables: Record<string, string>;
  preview?: string | null;
  background?: string | null;
  backgroundOpacity?: number | null;
}

export interface PlayerSettings {
  musicDir: string;
  musicDirs: string[];
  lastAddedMusicDir: string;
  lastAddedTrackIds: number[];
  recentPlayedTrackIds: number[];
  playlists: UserPlaylist[];
  theme: AppTheme;
  closeAction: 'exit' | 'tray';
  locale: Locale;
  sleepTimerAction: 'stop' | 'exit' | 'finishTrack';
  sleepTimerMinutes: number;
  autoHideLyricsDock: boolean;
  lyricFontSize: number;
  useThemeLyricColor: boolean;
  lyricFontColor: string;
  downloadDir: string;
  audioCacheDir: string;
  audioCacheMaxMb: number;
  audioOutputDeviceId: string;
  searchHistoryLimit: number;
  showTrackNumbers: boolean;
  showTrackCovers: boolean;
  enableLocalMetadataEditing: boolean;
  enableTrackMetadataEdit: boolean;
  enableTrackCoverEdit: boolean;
  enableTrackDurationRefresh: boolean;
  enablePlugins: boolean;
  qualityFallback: PlaybackQualityFallback;
  onlinePlaybackFailureAction: OnlinePlaybackFailureAction;
  seamlessPlayback: boolean;
  fadePlayback: boolean;
  crossfadePlayback: boolean;
  mcpAutoStart: boolean;
}

export type PlaybackQualityFallback = 'lower' | 'higher' | 'none';
export type OnlinePlaybackFailureAction = 'pause' | 'next';

export interface PlaybackSession {
  currentTrackId: number | null;
  currentTrackPath: string | null;
  queueTrackIds: number[];
  queueTrackPaths: string[];
  currentTime: number;
  playbackMode: PlaybackMode;
  savedAt: number;
}

export interface UserPlaylist {
  id: string;
  name: string;
  trackIds: number[];
  tracks?: Track[];
  createdAt: number;
}

export type PlaybackMode = 'shuffle' | 'repeat' | 'fixed';

export interface PlaylistSummary {
  title: string;
  count: number;
  selected: boolean;
  tone: 'night' | 'city' | 'mist' | 'stage' | 'desk' | 'road';
}
