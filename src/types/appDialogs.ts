import type { TrackMetadataFormValue } from '../composables/useTrackMetadataForm';
import type { Locale, Track, UserPlaylist } from './music';

export interface ScanFolderSelection {
  path: string;
  checked: boolean;
}

export interface AppDialogsProps {
  addToPlaylistTrack: Track | null;
  editingPlaylistId: string | null;
  isCancelingScan: boolean;
  isConfirmingScan: boolean;
  isPlaylistDialogOpen: boolean;
  isSavingTrackMetadata: boolean;
  isScanDialogOpen: boolean;
  locale: Locale;
  metadataEditingTrack: Track | null;
  newPlaylistName: string;
  playlists: UserPlaylist[];
  scanFolders: ScanFolderSelection[];
  scanProgressText: string;
  trackMetadataError: string | null;
  tracksForPlaylist: (playlist: UserPlaylist) => Track[];
}

export interface AppDialogsEmits {
  addScanFolder: [];
  addTrackToPlaylist: [track: Track, playlist: UserPlaylist];
  cancelScanFolders: [];
  changePlaylistName: [value: string];
  closeAddToPlaylistDialog: [];
  closeCreatePlaylistDialog: [];
  closeScanDialog: [];
  closeTrackMetadataDialog: [];
  confirmCreatePlaylist: [];
  confirmScanFolders: [];
  openCreatePlaylistFromAddDialog: [];
  removeScanFolder: [path: string];
  saveTrackMetadata: [value: TrackMetadataFormValue];
  updateScanFolderChecked: [path: string, checked: boolean];
}

export interface AppDialogsListeners {
  onAddScanFolder: () => void;
  onAddTrackToPlaylist: (...args: AppDialogsEmits['addTrackToPlaylist']) => void;
  onCancelScanFolders: () => void;
  onChangePlaylistName: (...args: AppDialogsEmits['changePlaylistName']) => void;
  onCloseAddToPlaylistDialog: () => void;
  onCloseCreatePlaylistDialog: () => void;
  onCloseScanDialog: () => void;
  onCloseTrackMetadataDialog: () => void;
  onConfirmCreatePlaylist: () => void;
  onConfirmScanFolders: () => void;
  onOpenCreatePlaylistFromAddDialog: () => void;
  onRemoveScanFolder: (...args: AppDialogsEmits['removeScanFolder']) => void;
  onSaveTrackMetadata: (...args: AppDialogsEmits['saveTrackMetadata']) => void;
  onUpdateScanFolderChecked: (...args: AppDialogsEmits['updateScanFolderChecked']) => void;
}
