import { computed, ref, type Ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { useContextMenus } from './useContextMenus';
import { usePlaylistDialogs } from './usePlaylistDialogs';
import { appendRustBackendQueue, insertRustBackendQueueNext, type RustQueueSnapshot } from '../services/playerBackend';
import { cropCoverImage, isTauriRuntime, openTrackInFolder } from '../services/music';
import type { usePlayerStore } from '../stores/player';
import type { Track, UserPlaylist } from '../types/music';
import { resolveLocale } from '../i18n';
import { getErrorMessage } from '../utils/error';
import { filePathToArtworkUrl } from '../utils/artwork';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface PlaylistActionsOptions {
  activePlaylistId: Ref<string | null>;
  onQueueSnapshot?: (snapshot: RustQueueSnapshot) => void;
  openLibraryView: () => void;
  player: PlayerStore;
}

export function usePlaylistActions({ activePlaylistId, onQueueSnapshot, openLibraryView, player }: PlaylistActionsOptions) {
  const {
    addToPlaylistTrack,
    closeAddToPlaylistDialog,
    closeCreatePlaylistDialog: closeCreatePlaylistDialogState,
    editingPlaylistId,
    isPlaylistDialogOpen,
    newPlaylistCover,
    newPlaylistName,
    openAddToPlaylistDialog: openAddToPlaylistDialogState,
    openCreatePlaylistDialog: openCreatePlaylistDialogState,
    openCreatePlaylistFromAddDialog,
    openRenamePlaylistDialog,
  } = usePlaylistDialogs();
  const {
    closeContextMenus,
    closePlaylistContextMenu,
    closeTrackContextMenu,
    openPlaylistContextMenu,
    openTrackContextMenu,
    playlistContextMenu,
    trackContextMenu,
  } = useContextMenus();
  const playlistCoverCropImagePath = ref('');
  const playlistCoverCropTargetId = ref<string | null>(null);
  const isSavingPlaylistCoverCrop = ref(false);

  const trackById = computed(() => {
    return new Map(player.tracks.map((track) => [track.id, track]));
  });

  function tracksForPlaylist(playlist: UserPlaylist) {
    const snapshotById = new Map((playlist.tracks ?? []).map((track) => [track.id, track]));
    return playlist.trackIds
      .map((id) => trackById.value.get(id) ?? snapshotById.get(id))
      .filter((track): track is Track => Boolean(track));
  }

  function openCreatePlaylistDialog() {
    closePlaylistContextMenu();
    openCreatePlaylistDialogState();
  }

  function closeCreatePlaylistDialog() {
    if (isSavingPlaylistCoverCrop.value) return;
    playlistCoverCropImagePath.value = '';
    playlistCoverCropTargetId.value = null;
    closeCreatePlaylistDialogState();
  }

  function confirmCreatePlaylist() {
    const name = newPlaylistName.value.trim();
    if (!name) return;

    if (editingPlaylistId.value) {
      if (!player.renamePlaylist(editingPlaylistId.value, name)) {
        player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'A playlist with this name already exists.' : '已存在同名歌单。';
        return;
      }
      closeCreatePlaylistDialog();
      return;
    }

    const playlistTracks = addToPlaylistTrack.value ? [addToPlaylistTrack.value] : [];
    if (!player.createPlaylist(name, playlistTracks, newPlaylistCover.value)) {
      player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'A playlist with this name already exists.' : '已存在同名歌单。';
      return;
    }
    closeCreatePlaylistDialog();
    closeAddToPlaylistDialog();
  }

  function openAddToPlaylistDialog(track: Track) {
    openAddToPlaylistDialogState(track);
    closeTrackContextMenu();
  }

  async function choosePlaylistCover() {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] }],
      });
      if (typeof selected !== 'string') return;

      playlistCoverCropImagePath.value = selected;
      playlistCoverCropTargetId.value = null;
    } catch (error) {
      player.error = getErrorMessage(error);
    }
  }

  async function chooseExistingPlaylistCover(playlistId: string) {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] }],
      });
      if (typeof selected !== 'string') return;

      playlistCoverCropImagePath.value = selected;
      playlistCoverCropTargetId.value = playlistId;
    } catch (error) {
      player.error = getErrorMessage(error);
    }
  }

  function closePlaylistCoverCropDialog() {
    if (isSavingPlaylistCoverCrop.value) return;
    playlistCoverCropImagePath.value = '';
    playlistCoverCropTargetId.value = null;
  }

  async function savePlaylistCoverCrop(payload: { x: number; y: number; size: number }) {
    if (!playlistCoverCropImagePath.value) return;

    isSavingPlaylistCoverCrop.value = true;
    try {
      const cropped = await cropCoverImage({ imagePath: playlistCoverCropImagePath.value, ...payload });
      const cover = filePathToArtworkUrl(cropped.path);
      if (playlistCoverCropTargetId.value) {
        player.updatePlaylistCover(playlistCoverCropTargetId.value, cover);
      } else {
        newPlaylistCover.value = cover;
      }
      playlistCoverCropImagePath.value = '';
      playlistCoverCropTargetId.value = null;
    } catch (error) {
      player.error = getErrorMessage(error);
    } finally {
      isSavingPlaylistCoverCrop.value = false;
    }
  }

  function clearPlaylistCover() {
    newPlaylistCover.value = null;
  }

  function startRenamePlaylist(playlist: UserPlaylist) {
    closePlaylistContextMenu();
    openRenamePlaylistDialog(playlist);
  }

  function deletePlaylist(playlist: UserPlaylist) {
    const deletedActivePlaylist = activePlaylistId.value === playlist.id;
    if (player.deletePlaylist(playlist.id) && deletedActivePlaylist) {
      openLibraryView();
    }
    closePlaylistContextMenu();
  }

  async function queueTrackNext(track: Track) {
    if (track.path) {
      try {
        onQueueSnapshot?.(await insertRustBackendQueueNext(track));
      } catch (err) {
        player.error = getErrorMessage(err);
      }
    }
    closeTrackContextMenu();
  }

  async function queueTrackLast(track: Track) {
    if (track.path) {
      try {
        onQueueSnapshot?.(await appendRustBackendQueue(track));
      } catch (err) {
        player.error = getErrorMessage(err);
      }
    }
    closeTrackContextMenu();
  }

  function addTrackToPlaylist(track: Track, playlist: UserPlaylist) {
    player.addTrackToPlaylist(track, playlist.id);
    closeTrackContextMenu();
    closeAddToPlaylistDialog();
  }

  function removeTrackFromActivePlaylist(track: Track) {
    if (!activePlaylistId.value) {
      closeTrackContextMenu();
      return;
    }

    player.removeTrackFromPlaylist(track, activePlaylistId.value);
    closeTrackContextMenu();
  }

  async function openTrackFolder(track: Track) {
    if (!track.path || !isTauriRuntime()) {
      closeTrackContextMenu();
      return;
    }

    try {
      await openTrackInFolder(track.path);
    } catch (err) {
      player.error = getErrorMessage(err);
    } finally {
      closeTrackContextMenu();
    }
  }

  return {
    addToPlaylistTrack,
    addTrackToPlaylist,
    chooseExistingPlaylistCover,
    choosePlaylistCover,
    clearPlaylistCover,
    closeAddToPlaylistDialog,
    closeContextMenus,
    closeCreatePlaylistDialog,
    closePlaylistCoverCropDialog,
    confirmCreatePlaylist,
    deletePlaylist,
    editingPlaylistId,
    isSavingPlaylistCoverCrop,
    isPlaylistDialogOpen,
    newPlaylistCover,
    newPlaylistName,
    openAddToPlaylistDialog,
    openCreatePlaylistDialog,
    openCreatePlaylistFromAddDialog,
    openPlaylistContextMenu,
    openTrackContextMenu,
    openTrackFolder,
    playlistContextMenu,
    playlistCoverCropImagePath,
    queueTrackLast,
    queueTrackNext,
    removeTrackFromActivePlaylist,
    savePlaylistCoverCrop,
    startRenamePlaylist,
    trackContextMenu,
    tracksForPlaylist,
  };
}
