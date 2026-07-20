import type { PlayerSettings } from '../../types/music';

export const SETTINGS_KEY = 'mono-player-settings';
export const FAVORITES_KEY = 'mono-player-favorites';
export const CUSTOM_THEMES_KEY = 'mono-player-custom-themes';
export const SYSTEM_THEME_KEY = 'mono-player-system-theme-state';
export const PLAYBACK_SESSION_KEY = 'mono-player-playback-session';
export const STARTUP_THEME_KEY = 'mono-player-startup-theme';
export const STARTUP_BG_KEY = 'mono-player-startup-bg';

export const MIN_LYRIC_FONT_SIZE = 14;
export const MAX_LYRIC_FONT_SIZE = 34;
export const MIN_SLEEP_TIMER_MINUTES = 1;
export const MAX_SLEEP_TIMER_MINUTES = 999;
export const MIN_SEARCH_HISTORY_LIMIT = 1;
export const MAX_SEARCH_HISTORY_LIMIT = 25;
export const MIN_AUDIO_CACHE_MAX_MB = 64;
export const MAX_AUDIO_CACHE_MAX_MB = 51200;

export const QUALITY_FALLBACKS = ['lower', 'higher', 'none'] as const;
export const ONLINE_PLAYBACK_FAILURE_ACTIONS = ['pause', 'next'] as const;

export const fallbackSettings: PlayerSettings = {
  musicDir: '',
  musicDirs: [],
  lastAddedMusicDir: '',
  lastAddedTrackIds: [],
  recentPlayedTrackIds: [],
  playlists: [],
  theme: 'blueWhite',
  closeAction: 'exit',
  locale: 'system',
  sleepTimerAction: 'stop',
  sleepTimerMinutes: 30,
  autoHideLyricsDock: false,
  lyricFontSize: 17,
  useThemeLyricColor: true,
  lyricFontColor: '#e31a1a',
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
};
