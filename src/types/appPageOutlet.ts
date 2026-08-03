import type { AppView, LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { ArtistGroup, LocalFolderItem } from './library';
import type { DownloadManagerViewEmits, DownloadManagerViewListeners, DownloadManagerViewProps } from './downloadManager';
import type { DownloadItem, Track } from './music';
import type { OnlineSearchSnapshot } from './onlineSearch';
import type { PluginSearchTrack } from './plugin';

export interface AppPageOutletProps {
  activeArtistName: string | null;
  activeCollection: LibraryCollection;
  activeFolderPath: string | null;
  activeLibraryFilter: LibraryFilter;
  activePlaylistId: string | null;
  activeTrack: Track | null;
  activeView: AppView;
  artistGroups: ArtistGroup[];
  downloadedTrackKeys: string[];
  downloadItems: DownloadItem[];
  favoriteTrackIds: number[];
  isAudioPlaying: boolean;
  isLibraryPanelMode: boolean;
  isOnlineSearchOpen: boolean;
  isPreparingActiveTrack: boolean;
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  localFolderTrackCount: number;
  localFolders: LocalFolderItem[];
  onlineActiveTrackKey: string | null;
  onlinePreparingTrackKey: string | null;
  onlineSearchError: string | null;
  pendingDownloadTrackKeys: string[];
  playbackSpectrumLevels: number[];
  playerError: string | null;
  playerQuery: string;
  recentAddedTrackCount: number;
  visibleTracks: Track[];
}

export interface AppPageOutletEmits {
  addDownloadedTrackToPlaylist: [item: DownloadItem];
  chooseFolder: [];
  clearDownloadedItemRecord: [item: DownloadItem];
  deleteDownloadedItem: [item: DownloadItem];
  downloadTrack: [track: Track];
  notify: [message: string, variant?: 'success' | 'error'];
  onlineSearchStarted: [];
  onlineSearchUpdated: [snapshot: OnlineSearchSnapshot];
  openArtistFromTrack: [artistName: string];
  openDownloadedItemFolder: [item: DownloadItem];
  openLocalFolderFromPanel: [path: string];
  openOnlineTrackContextMenu: [track: PluginSearchTrack, x: number, y: number];
  openRecentAddedFromPanel: [];
  openScanDialog: [];
  openTrackContextMenu: [track: Track, x: number, y: number];
  pauseDownloadItem: [item: DownloadItem];
  playDownloadedTrack: [track: Track];
  playFavoriteTracks: [];
  playOnlineTrack: [track: PluginSearchTrack];
  playTrack: [track: Track];
  queueDownloadedTrackNext: [item: DownloadItem];
  rescanLibrary: [];
  retryDownloadItem: [item: DownloadItem];
  resumeDownloadItem: [item: DownloadItem];
  returnToLocalLibrary: [];
  selectArtist: [artistName: string];
  selectTrack: [track: Track];
  toggleFavoriteForTrack: [track: Track];
  updatePlayerQuery: [value: string];
}

export interface AppLibraryHomePageOutletProps {
  activeCollection: LibraryCollection;
  activeFolderPath: string | null;
  activeLibraryFilter: LibraryFilter;
  activePlaylistId: string | null;
  activeTrack: Track | null;
  favoriteTrackIds: number[];
  isAudioPlaying: boolean;
  isOnlineSearchOpen: boolean;
  isPreparingActiveTrack: boolean;
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  localFolderTrackCount: number;
  localFolders: LocalFolderItem[];
  playbackSpectrumLevels: number[];
  playerError: string | null;
  playerQuery: string;
  recentAddedTrackCount: number;
  visibleTracks: Track[];
}

export interface AppLibraryHomePageOutletEmits {
  chooseFolder: [];
  openArtistFromTrack: [artistName: string];
  openLocalFolderFromPanel: [path: string];
  openRecentAddedFromPanel: [];
  openScanDialog: [];
  openTrackContextMenu: [track: Track, x: number, y: number];
  playFavoriteTracks: [];
  playTrack: [track: Track];
  rescanLibrary: [];
  returnToLocalLibrary: [];
  selectTrack: [track: Track];
  toggleFavoriteForTrack: [track: Track];
  updatePlayerQuery: [value: string];
}

export interface AppLibraryHomePageOutletListeners {
  onChooseFolder: () => void;
  onOpenArtistFromTrack: (...args: AppLibraryHomePageOutletEmits['openArtistFromTrack']) => void;
  onOpenLocalFolderFromPanel: (...args: AppLibraryHomePageOutletEmits['openLocalFolderFromPanel']) => void;
  onOpenRecentAddedFromPanel: () => void;
  onOpenScanDialog: () => void;
  onOpenTrackContextMenu: (...args: AppLibraryHomePageOutletEmits['openTrackContextMenu']) => void;
  onPlayFavoriteTracks: () => void;
  onPlayTrack: (...args: AppLibraryHomePageOutletEmits['playTrack']) => void;
  onRescanLibrary: () => void;
  onReturnToLocalLibrary: () => void;
  onSelectTrack: (...args: AppLibraryHomePageOutletEmits['selectTrack']) => void;
  onToggleFavoriteForTrack: (...args: AppLibraryHomePageOutletEmits['toggleFavoriteForTrack']) => void;
  onUpdatePlayerQuery: (...args: AppLibraryHomePageOutletEmits['updatePlayerQuery']) => void;
}

export type LibraryHomePageListeners = AppLibraryHomePageOutletListeners;

export interface AppDiscoverPageOutletProps {
  activePlaybackTrack: Track | null;
  activeTrackKey: string | null;
  downloadedTrackKeys: string[];
  favoriteTrackIds: number[];
  isPlaying: boolean;
  pendingDownloadTrackKeys: string[];
  resolvingTrackKey: string | null;
  searchError: string | null;
  spectrumLevels: number[];
}

export interface AppDiscoverPageOutletEmits {
  backLocal: [];
  downloadTrack: [track: Track];
  notify: [message: string, variant?: 'success' | 'error'];
  openTrackMenu: [track: PluginSearchTrack, x: number, y: number];
  playTrack: [track: PluginSearchTrack];
  searchReady: [snapshot: OnlineSearchSnapshot];
  searchStarted: [];
  searchUpdated: [snapshot: OnlineSearchSnapshot];
  toggleFavorite: [track: Track];
}

export interface AppDiscoverPageOutletListeners {
  onBackLocal: () => void;
  onDownloadTrack: (...args: AppDiscoverPageOutletEmits['downloadTrack']) => void;
  onNotify: (...args: AppDiscoverPageOutletEmits['notify']) => void;
  onOpenTrackMenu: (...args: AppDiscoverPageOutletEmits['openTrackMenu']) => void;
  onPlayTrack: (...args: AppDiscoverPageOutletEmits['playTrack']) => void;
  onSearchReady: (...args: AppDiscoverPageOutletEmits['searchReady']) => void;
  onSearchStarted: () => void;
  onSearchUpdated: (...args: AppDiscoverPageOutletEmits['searchUpdated']) => void;
  onToggleFavorite: (...args: AppDiscoverPageOutletEmits['toggleFavorite']) => void;
}

export type DiscoverMusicPageListeners = AppDiscoverPageOutletListeners;

export interface AppWorkspacePageOutletProps {
  activeCollection: LibraryCollection;
  activePlaylistId: string | null;
  activeTrack: Track | null;
  error: string | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  isPreparingActiveTrack: boolean;
  libraryFilter: LibraryFilter;
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  modelValue: string;
  spectrumLevels: number[];
  tracks: Track[];
}

export interface AppWorkspacePageOutletEmits {
  'update:modelValue': [value: string];
  openArtist: [artistName: string];
  openTrackMenu: [track: Track, x: number, y: number];
  playFavoriteTracks: [];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface AppWorkspacePageOutletListeners {
  'onUpdate:modelValue': (...args: AppWorkspacePageOutletEmits['update:modelValue']) => void;
  onOpenArtist: (...args: AppWorkspacePageOutletEmits['openArtist']) => void;
  onOpenTrackMenu: (...args: AppWorkspacePageOutletEmits['openTrackMenu']) => void;
  onPlayFavoriteTracks: () => void;
  onPlayTrack: (...args: AppWorkspacePageOutletEmits['playTrack']) => void;
  onSelectTrack: (...args: AppWorkspacePageOutletEmits['selectTrack']) => void;
  onToggleFavorite: (...args: AppWorkspacePageOutletEmits['toggleFavorite']) => void;
}

export interface AppArtistsPageOutletProps {
  activeArtistName: string | null;
  activeTrack: Track | null;
  artistGroups: ArtistGroup[];
  favoriteTrackIds: number[];
  isPlaying: boolean;
  modelValue: string;
  spectrumLevels: number[];
}

export interface AppArtistsPageOutletEmits {
  'update:modelValue': [value: string];
  openTrackMenu: [track: Track, x: number, y: number];
  playTrack: [track: Track];
  selectArtist: [artistName: string];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface AppArtistsPageOutletListeners {
  'onUpdate:modelValue': (...args: AppArtistsPageOutletEmits['update:modelValue']) => void;
  onOpenTrackMenu: (...args: AppArtistsPageOutletEmits['openTrackMenu']) => void;
  onPlayTrack: (...args: AppArtistsPageOutletEmits['playTrack']) => void;
  onSelectArtist: (...args: AppArtistsPageOutletEmits['selectArtist']) => void;
  onSelectTrack: (...args: AppArtistsPageOutletEmits['selectTrack']) => void;
  onToggleFavorite: (...args: AppArtistsPageOutletEmits['toggleFavorite']) => void;
}

export type ArtistsViewListeners = AppArtistsPageOutletListeners;

export type AppDownloadsPageOutletProps = DownloadManagerViewProps;

export type AppDownloadsPageOutletEmits = DownloadManagerViewEmits;

export type AppDownloadsPageOutletListeners = DownloadManagerViewListeners;

export interface AppUtilityPageOutletProps {
  activeView: AppView;
}

export interface AppUtilityPageOutletEmits {
  notify: [message: string, variant?: 'success' | 'error'];
}

export interface AppUtilityPageOutletListeners {
  onNotify: (...args: AppUtilityPageOutletEmits['notify']) => void;
}

export type PluginManagerViewListeners = AppUtilityPageOutletListeners;
