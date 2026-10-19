import type { LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { Track } from './music';

export interface LocalFolderItem {
  path: string;
  title: string;
  count: number;
  totalSeconds: number;
  tracks: Track[];
  filteredCount: number;
  filteredTotalSeconds: number;
  filteredTracks: Track[];
  tone: 'desk' | 'night' | 'mist' | 'road';
}

export interface ArtistGroup {
  name: string;
  count: number;
  totalSeconds: number;
  tracks: Track[];
}

export interface LibraryStatistics {
  artists: ArtistGroup[];
  artistCount: number;
  artistTrackCount: number;
  folders: Omit<LocalFolderItem, 'tone'>[];
  folderTrackCount: number;
}

export interface LibraryPanelProps {
  downloadsActive?: boolean;
  activeCollection: LibraryCollection;
  activeFolderPath: string | null;
  activeLibraryFilter: LibraryFilter;
  activeOnlineSearch: boolean;
  localFolders: LocalFolderItem[];
  recentAddedCount: number;
  showDownloads: boolean;
  visibleTrackCount: number;
}

export interface LibraryPanelEmits {
  chooseFolder: [];
  openAll: [];
  openFolder: [path: string];
  openRecentAdded: [];
  openRecentPlayed: [];
  openDownloads: [];
  openArtists: [];
  openScanDialog: [];
}

export interface LibraryPanelListeners {
  onChooseFolder: (...args: LibraryPanelEmits['chooseFolder']) => void;
  onOpenAll: (...args: LibraryPanelEmits['openAll']) => void;
  onOpenFolder: (...args: LibraryPanelEmits['openFolder']) => void;
  onOpenRecentAdded: (...args: LibraryPanelEmits['openRecentAdded']) => void;
  onOpenRecentPlayed: (...args: LibraryPanelEmits['openRecentPlayed']) => void;
  onOpenDownloads: (...args: LibraryPanelEmits['openDownloads']) => void;
  onOpenArtists: (...args: LibraryPanelEmits['openArtists']) => void;
  onOpenScanDialog: (...args: LibraryPanelEmits['openScanDialog']) => void;
}
