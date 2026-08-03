import type { LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { Track } from './music';

export interface LocalFolderItem {
  path: string;
  title: string;
  count: number;
  tracks: Track[];
  tone: 'desk' | 'night' | 'mist' | 'road';
}

export interface ArtistGroup {
  name: string;
  tracks: Track[];
}

export interface LibraryPanelProps {
  activeCollection: LibraryCollection;
  activeFolderPath: string | null;
  activeLibraryFilter: LibraryFilter;
  activeOnlineSearch: boolean;
  localFolders: LocalFolderItem[];
  recentAddedCount: number;
  visibleTrackCount: number;
}

export interface LibraryPanelEmits {
  chooseFolder: [];
  openAll: [];
  openFolder: [path: string];
  openRecentAdded: [];
  openScanDialog: [];
}

export interface LibraryPanelListeners {
  onChooseFolder: (...args: LibraryPanelEmits['chooseFolder']) => void;
  onOpenAll: (...args: LibraryPanelEmits['openAll']) => void;
  onOpenFolder: (...args: LibraryPanelEmits['openFolder']) => void;
  onOpenRecentAdded: (...args: LibraryPanelEmits['openRecentAdded']) => void;
  onOpenScanDialog: (...args: LibraryPanelEmits['openScanDialog']) => void;
}
