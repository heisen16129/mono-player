import type { LyricsBackgroundSettings, PlayerSettings, ShortcutBindings } from '../../types/music';

export const SETTINGS_KEY = 'mono-player-settings';
export const STARTUP_BG_KEY = 'mono-player-startup-bg';

export const MIN_LYRIC_FONT_SIZE = 14;
export const MAX_LYRIC_FONT_SIZE = 34;


export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = {
  togglePlayback: 'Space',
  nextTrack: 'Ctrl+Right',
  previousTrack: 'Ctrl+Left',
  volumeUp: 'Ctrl+Up',
  volumeDown: 'Ctrl+Down',
  toggleDesktopLyrics: 'Ctrl+L',
  toggleFavorite: 'Ctrl+F',
  togglePlaybackMode: 'Ctrl+M',
};

export const DEFAULT_LYRICS_BACKGROUND: LyricsBackgroundSettings = {
  source: 'cover',
  color: '#000000',
  colorMode: 'custom',
  coverColor: '',
  mediaPath: '',
  mediaKind: 'image',
  wallpaperRoot: '',
  wallpaperProjectId: '',
  wallpaperTitle: '',
  wallpaperProjectType: 'unknown',
  wallpaperMediaPath: '',
  wallpaperPreviewPath: '',
  opacity: 0.72,
  blur: 0,
  windowOpacity: 1,
  positionX: 50,
  positionY: 50,
  scale: 1,
};

export const fallbackSettings: PlayerSettings = {
  musicDir: '',
  musicDirs: [],
  theme: 'blueWhite',
  closeAction: 'exit',
  locale: 'system',
  sleepTimerAction: 'stop',
  sleepTimerMinutes: 30,
  autoHideLyricsDock: false,
  lyricFontSize: 17,
  useThemeLyricColor: true,
  lyricFontColor: '#e31a1a',
  lyricsBackground: DEFAULT_LYRICS_BACKGROUND,
  downloadDir: '',
  audioCacheDir: '',
  audioCacheMaxMb: 1024,
  audioOutputDeviceId: '',
  searchHistoryLimit: 10,
  showTrackNumbers: true,
  showTrackCovers: true,
  enableLocalMetadataEditing: false,
  enableTrackMetadataEdit: false,
  enableTrackCoverEdit: false,
  enableTrackDurationRefresh: false,
  enablePlugins: false,
  qualityFallback: 'lower',
  onlinePlaybackFailureAction: 'pause',
  seamlessPlayback: true,
  fadePlayback: false,
  crossfadePlayback: false,
  mcpAutoStart: true,
  enableAppShortcuts: true,
  appShortcuts: DEFAULT_SHORTCUT_BINDINGS,
};
