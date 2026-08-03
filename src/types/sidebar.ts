import type { AppView, LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { Locale, UserPlaylist } from './music';

export interface PrimarySidebarProps {
  activeCollection: LibraryCollection;
  activeLibraryFilter: LibraryFilter;
  activePlaylistId: string | null;
  activeView: AppView;
  collapsed: boolean;
  enablePlugins: boolean;
  playlists: UserPlaylist[];
  showDownloads: boolean;
}

export interface PrimarySidebarEmits {
  createPlaylist: [];
  openArtists: [];
  openDiscover: [];
  openDownloads: [];
  openFavorites: [];
  openLibrary: [];
  openPlaylist: [playlistId: string];
  openPlaylistMenu: [playlist: UserPlaylist, x: number, y: number];
  openPlugins: [];
  openRecentAdded: [];
  openRecentPlayed: [];
  openSettings: [];
  openTheme: [];
  toggleCollapsed: [];
}

export interface PrimarySidebarListeners {
  onCreatePlaylist: (...args: PrimarySidebarEmits['createPlaylist']) => void;
  onOpenArtists: (...args: PrimarySidebarEmits['openArtists']) => void;
  onOpenDiscover: (...args: PrimarySidebarEmits['openDiscover']) => void;
  onOpenDownloads: (...args: PrimarySidebarEmits['openDownloads']) => void;
  onOpenFavorites: (...args: PrimarySidebarEmits['openFavorites']) => void;
  onOpenLibrary: (...args: PrimarySidebarEmits['openLibrary']) => void;
  onOpenPlaylist: (...args: PrimarySidebarEmits['openPlaylist']) => void;
  onOpenPlaylistMenu: (...args: PrimarySidebarEmits['openPlaylistMenu']) => void;
  onOpenPlugins: (...args: PrimarySidebarEmits['openPlugins']) => void;
  onOpenRecentAdded: (...args: PrimarySidebarEmits['openRecentAdded']) => void;
  onOpenRecentPlayed: (...args: PrimarySidebarEmits['openRecentPlayed']) => void;
  onOpenSettings: (...args: PrimarySidebarEmits['openSettings']) => void;
  onOpenTheme: (...args: PrimarySidebarEmits['openTheme']) => void;
  onToggleCollapsed: (...args: PrimarySidebarEmits['toggleCollapsed']) => void;
}

export interface AppSidebarOutletProps extends PrimarySidebarProps {
  isLibraryPanelMode: boolean;
}

export type AppSidebarOutletEmits = PrimarySidebarEmits;

export type AppSidebarOutletListeners = PrimarySidebarListeners;

export interface SidebarNavProps extends PrimarySidebarProps {
  locale: Locale;
}

export interface SidebarNavEmits {
  createPlaylist: [];
  openArtists: [];
  openDiscover: [];
  openDownloads: [];
  openFavorites: [];
  openLibrary: [];
  openPlaylist: [playlistId: string];
  openPlaylistMenu: [playlist: UserPlaylist, x: number, y: number];
  openPlugins: [];
  openRecentAdded: [];
  openRecentPlayed: [];
}

export interface SidebarNavListeners {
  onCreatePlaylist: (...args: SidebarNavEmits['createPlaylist']) => void;
  onOpenArtists: (...args: SidebarNavEmits['openArtists']) => void;
  onOpenDiscover: (...args: SidebarNavEmits['openDiscover']) => void;
  onOpenDownloads: (...args: SidebarNavEmits['openDownloads']) => void;
  onOpenFavorites: (...args: SidebarNavEmits['openFavorites']) => void;
  onOpenLibrary: (...args: SidebarNavEmits['openLibrary']) => void;
  onOpenPlaylist: (...args: SidebarNavEmits['openPlaylist']) => void;
  onOpenPlaylistMenu: (...args: SidebarNavEmits['openPlaylistMenu']) => void;
  onOpenPlugins: (...args: SidebarNavEmits['openPlugins']) => void;
  onOpenRecentAdded: (...args: SidebarNavEmits['openRecentAdded']) => void;
  onOpenRecentPlayed: (...args: SidebarNavEmits['openRecentPlayed']) => void;
}

export interface SidebarMainNavLinksProps {
  activeCollection: LibraryCollection;
  activeLibraryFilter: LibraryFilter;
  activeView: AppView;
  collapsed: boolean;
  enablePlugins: boolean;
  locale: Locale;
  showDownloads: boolean;
}

export interface SidebarMainNavLinksEmits {
  openArtists: [];
  openDiscover: [];
  openDownloads: [];
  openLibrary: [];
  openPlugins: [];
  openRecentAdded: [];
  openRecentPlayed: [];
}

export interface SidebarMainNavLinksListeners {
  onOpenArtists: (...args: SidebarMainNavLinksEmits['openArtists']) => void;
  onOpenDiscover: (...args: SidebarMainNavLinksEmits['openDiscover']) => void;
  onOpenDownloads: (...args: SidebarMainNavLinksEmits['openDownloads']) => void;
  onOpenLibrary: (...args: SidebarMainNavLinksEmits['openLibrary']) => void;
  onOpenPlugins: (...args: SidebarMainNavLinksEmits['openPlugins']) => void;
  onOpenRecentAdded: (...args: SidebarMainNavLinksEmits['openRecentAdded']) => void;
  onOpenRecentPlayed: (...args: SidebarMainNavLinksEmits['openRecentPlayed']) => void;
}

export interface SidebarPlaylistNavListProps {
  activePlaylistId: string | null;
  collapsed: boolean;
  playlists: UserPlaylist[];
}

export interface SidebarPlaylistNavListEmits {
  openPlaylist: [playlistId: string];
  openPlaylistMenu: [playlist: UserPlaylist, x: number, y: number];
}

export interface SidebarPlaylistNavListListeners {
  onOpenPlaylist: (...args: SidebarPlaylistNavListEmits['openPlaylist']) => void;
  onOpenPlaylistMenu: (...args: SidebarPlaylistNavListEmits['openPlaylistMenu']) => void;
}

export interface SidebarPlaylistCreateControlProps {
  collapsed: boolean;
  locale: Locale;
}

export interface SidebarPlaylistCreateControlEmits {
  createPlaylist: [];
}

export interface SidebarPlaylistCreateControlListeners {
  onCreatePlaylist: (...args: SidebarPlaylistCreateControlEmits['createPlaylist']) => void;
}

export interface SidebarFavoritesNavLinkProps {
  active: boolean;
  collapsed: boolean;
  locale: Locale;
}

export interface SidebarFavoritesNavLinkEmits {
  openFavorites: [];
}

export interface SidebarFavoritesNavLinkListeners {
  onOpenFavorites: (...args: SidebarFavoritesNavLinkEmits['openFavorites']) => void;
}
