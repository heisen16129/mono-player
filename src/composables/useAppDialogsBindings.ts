import { computed } from 'vue';
import type { AppDialogsListeners, AppDialogsProps } from '../types/appDialogs';

type AppDialogsPropSources = {
  [Key in keyof AppDialogsProps]: () => AppDialogsProps[Key];
};

interface UseAppDialogsBindingsOptions {
  listeners: AppDialogsListeners;
  props: AppDialogsPropSources;
}

export function useAppDialogsBindings({ listeners, props }: UseAppDialogsBindingsOptions) {
  const appDialogsProps = computed<AppDialogsProps>(() => ({
    addToPlaylistTrack: props.addToPlaylistTrack(),
    coverCropImagePath: props.coverCropImagePath(),
    coverCropTrack: props.coverCropTrack(),
    editingPlaylistId: props.editingPlaylistId(),
    isCancelingScan: props.isCancelingScan(),
    isConfirmingScan: props.isConfirmingScan(),
    isPlaylistDialogOpen: props.isPlaylistDialogOpen(),
    isSavingCoverCrop: props.isSavingCoverCrop(),
    isSavingPlaylistCoverCrop: props.isSavingPlaylistCoverCrop(),
    isSavingTrackMetadata: props.isSavingTrackMetadata(),
    isScanDialogOpen: props.isScanDialogOpen(),
    locale: props.locale(),
    metadataEditingTrack: props.metadataEditingTrack(),
    newPlaylistCover: props.newPlaylistCover(),
    newPlaylistName: props.newPlaylistName(),
    playlistCoverCropImagePath: props.playlistCoverCropImagePath(),
    playlists: props.playlists(),
    scanFolders: props.scanFolders(),
    scanProgressText: props.scanProgressText(),
    trackMetadataError: props.trackMetadataError(),
    tracksForPlaylist: props.tracksForPlaylist(),
  }));

  return {
    appDialogsListeners: listeners,
    appDialogsProps,
  };
}
