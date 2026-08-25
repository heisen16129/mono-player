import type { Component } from 'vue';
import type {
  PluginConfig,
  PluginConfigSchema,
  PluginSearchProvider,
  PluginSearchTrack,
} from './plugin';
import type { LyricLine } from './music';

export interface LyricsRendererActionMenuContext {
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
  close: () => void;
  clearAssociatedLyrics: () => void;
  closeLyricSync: () => void;
  decreaseFontSize: () => void;
  downloadCover: () => void;
  downloadLyrics: (format: string) => void;
  increaseFontSize: () => void;
  openLyricSearch: () => void;
  openLyricSync: () => void;
  openSettings: () => void;
  toggleFullscreen: () => void;
  togglePlayerDock: () => void;
}

export interface LyricsRendererSearchDialogContext {
  isLoadingMore: boolean;
  isOpen: boolean;
  isSearching: boolean;
  providerId: string | null;
  providers: PluginSearchProvider[];
  query: string;
  resolvingTrackKey: string | null;
  results: PluginSearchTrack[];
  status: string;
  tabItems: Array<{ disabled?: boolean; id: string | null; label: string }>;
  apply: (track: PluginSearchTrack) => void;
  close: () => void;
  scroll: (event: Event) => void;
  search: () => void;
  selectProvider: (id: string | null) => void;
  trackKey: (track: PluginSearchTrack) => string;
  updateQuery: (value: string) => void;
}

export interface LyricsRendererContext {
  actionMenu: LyricsRendererActionMenuContext;
  searchDialog: LyricsRendererSearchDialogContext;
  lines: LyricLine[];
  currentTime: number;
  isPlaying: boolean;
  isFavorite: boolean;
  activeLyricIndex: number;
  lyricTimeOffset: number;
  fontSize: number;
  lyricColor: string | null;
  useThemeLyricColor: boolean;
  coverUrl: string | null;
  isLoading: boolean;
  emptyMessage: string;
  loadingText: string;
  isPlayerDockHidden: boolean;
  isLyricSyncOpen: boolean;
  isScrolling: boolean;
  scrollThumbTop: number;
  label: string;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  volume: number;
  config: PluginConfig;
  lyricWordProgress: (line: LyricLine, lineIndex: number, wordIndex: number) => string;
  seek: (line: LyricLine) => void;
  beginBrowse: () => void;
  coverError: () => void;
  hideScrollbar: () => void;
  openSearch: () => void;
  restoreRealtime: () => void;
  setLyricsPanelRef: (instance: unknown) => void;
  syncScroll: () => void;
  handleWheel: () => void;
  shiftTiming: (deltaSeconds: number) => void;
  close: () => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleFavorite: () => void;
  seekToTime: (time: number) => void;
  setVolume: (value: number) => void;
  updateConfig: (config: PluginConfig) => void;
  openActionMenu: (event: MouseEvent) => void;
}

export interface LyricsRendererHandle {
  update: (context: LyricsRendererContext) => void;
  destroy: () => void;
}

export interface LyricsRendererPlugin {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  component: Component;
  ownsSurface?: boolean;
  configSchema?: PluginConfigSchema | null;
  defaultConfig?: PluginConfig;
}
