<script setup lang="ts">
import AddToPlaylistDialog from './AddToPlaylistDialog.vue';
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
    :editing="Boolean(editingPlaylistId)"
    :locale="locale"
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
