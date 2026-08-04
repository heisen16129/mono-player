<script setup lang="ts">
import AddToPlaylistDialog from './AddToPlaylistDialog.vue';
import CoverCropDialog from './CoverCropDialog.vue';
import PlaylistDialog from './PlaylistDialog.vue';
import ScanDialog from './ScanDialog.vue';
import TrackMetadataDialog from './TrackMetadataDialog.vue';
import type { AppDialogsEmits, AppDialogsProps } from '../types/appDialogs';

defineProps<AppDialogsProps>();

defineEmits<AppDialogsEmits>();
</script>

<template>
  <TrackMetadataDialog
    v-if="metadataEditingTrack"
    :error="trackMetadataError"
    :locale="locale"
    :saving="isSavingTrackMetadata"
    :track="metadataEditingTrack"
    @close="$emit('closeTrackMetadataDialog')"
    @save="$emit('saveTrackMetadata', $event)"
  />

  <CoverCropDialog
    v-if="coverCropTrack && coverCropImagePath"
    :image-path="coverCropImagePath"
    :saving="isSavingCoverCrop"
    @close="$emit('closeCoverCropDialog')"
    @confirm="$emit('saveCoverCrop', $event)"
  />

  <CoverCropDialog
    v-if="playlistCoverCropImagePath"
    :image-path="playlistCoverCropImagePath"
    :saving="isSavingPlaylistCoverCrop"
    @close="$emit('closePlaylistCoverCropDialog')"
    @confirm="$emit('savePlaylistCoverCrop', $event)"
  />

  <AddToPlaylistDialog
    v-if="addToPlaylistTrack"
    :locale="locale"
    :playlists="playlists"
    :track="addToPlaylistTrack"
    :tracks-for-playlist="tracksForPlaylist"
    @close="$emit('closeAddToPlaylistDialog')"
    @create-playlist="$emit('openCreatePlaylistFromAddDialog')"
    @add-track="(track, playlist) => $emit('addTrackToPlaylist', track, playlist)"
  />

  <PlaylistDialog
    v-if="isPlaylistDialogOpen"
    :name="newPlaylistName"
    :cover="newPlaylistCover"
    :editing="Boolean(editingPlaylistId)"
    :locale="locale"
    @choose-cover="$emit('choosePlaylistCover')"
    @clear-cover="$emit('clearPlaylistCover')"
    @update:name="$emit('changePlaylistName', $event)"
    @close="$emit('closeCreatePlaylistDialog')"
    @confirm="$emit('confirmCreatePlaylist')"
  />

  <ScanDialog
    v-if="isScanDialogOpen"
    :canceling="isCancelingScan"
    :confirming="isConfirmingScan"
    :folders="scanFolders"
    :locale="locale"
    :progress-text="scanProgressText"
    @close="$emit('closeScanDialog')"
    @add-folder="$emit('addScanFolder')"
    @cancel="$emit('cancelScanFolders')"
    @remove-folder="$emit('removeScanFolder', $event)"
    @confirm="$emit('confirmScanFolders')"
    @update-folder-checked="(path, checked) => $emit('updateScanFolderChecked', path, checked)"
  />
</template>
