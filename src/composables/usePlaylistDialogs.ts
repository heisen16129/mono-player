import { ref } from 'vue';
import type { Track, UserPlaylist } from '../types/music';

export function usePlaylistDialogs() {
  const isPlaylistDialogOpen = ref(false);
  const addToPlaylistTrack = ref<Track | null>(null);
  const newPlaylistName = ref('');
  const newPlaylistCover = ref<string | null>(null);
  const editingPlaylistId = ref<string | null>(null);

  function openCreatePlaylistDialog() {
    editingPlaylistId.value = null;
    newPlaylistName.value = '';
    newPlaylistCover.value = null;
    isPlaylistDialogOpen.value = true;
  }

  function openCreatePlaylistFromAddDialog() {
    editingPlaylistId.value = null;
    newPlaylistName.value = '';
    newPlaylistCover.value = null;
    isPlaylistDialogOpen.value = true;
  }

  function closeCreatePlaylistDialog() {
    isPlaylistDialogOpen.value = false;
    newPlaylistName.value = '';
    newPlaylistCover.value = null;
    editingPlaylistId.value = null;
  }

  function openAddToPlaylistDialog(track: Track) {
    addToPlaylistTrack.value = track;
  }

  function closeAddToPlaylistDialog() {
    addToPlaylistTrack.value = null;
  }

  function openRenamePlaylistDialog(playlist: UserPlaylist) {
    editingPlaylistId.value = playlist.id;
    newPlaylistName.value = playlist.name;
    newPlaylistCover.value = playlist.cover ?? null;
    isPlaylistDialogOpen.value = true;
  }

  return {
    addToPlaylistTrack,
    closeAddToPlaylistDialog,
    closeCreatePlaylistDialog,
    editingPlaylistId,
    isPlaylistDialogOpen,
    newPlaylistCover,
    newPlaylistName,
    openAddToPlaylistDialog,
    openCreatePlaylistDialog,
    openCreatePlaylistFromAddDialog,
    openRenamePlaylistDialog,
  };
}
