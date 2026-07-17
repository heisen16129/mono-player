import { computed, ref, type Ref } from 'vue';
import { appendRustBackendQueue, insertRustBackendQueueNext, type RustQueueSnapshot } from '../services/playerBackend';
import { isTauriRuntime, openTrackInFolder } from '../services/music';
import type { usePlayerStore } from '../stores/player';
import type { Track, UserPlaylist } from '../types/music';
import { resolveLocale } from '../i18n';
import { getErrorMessage } from '../utils/error';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface PlaylistActionsOptions {
  activePlaylistId: Ref<string | null>;
  onQueueSnapshot?: (snapshot: RustQueueSnapshot) => void;
  openLibraryView: () => void;
  player: PlayerStore;
}

export function usePlaylistActions({ activePlaylistId, onQueueSnapshot, openLibraryView, player }: PlaylistActionsOptions) {
  const isPlaylistDialogOpen = ref(false);
  const addToPlaylistTrack = ref<Track | null>(null);
  const newPlaylistName = ref('');
  const editingPlaylistId = ref<string | null>(null);
  const playlistContextMenu = ref<{ playlist: UserPlaylist; x: number; y: number } | null>(null);
  const trackContextMenu = ref<{ track: Track; x: number; y: number } | null>(null);

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
    editingPlaylistId.value = null;
    newPlaylistName.value = '';
    isPlaylistDialogOpen.value = true;
  }

  function openCreatePlaylistFromAddDialog() {
    editingPlaylistId.value = null;
    newPlaylistName.value = '';
    isPlaylistDialogOpen.value = true;
  }

  function closeCreatePlaylistDialog() {
    isPlaylistDialogOpen.value = false;
    newPlaylistName.value = '';
    editingPlaylistId.value = null;
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
    if (!player.createPlaylist(name, playlistTracks)) {
      player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'A playlist with this name already exists.' : '已存在同名歌单。';
      return;
    }
    closeCreatePlaylistDialog();
    closeAddToPlaylistDialog();
  }

  function openPlaylistContextMenu(playlist: UserPlaylist, x: number, y: number) {
    playlistContextMenu.value = { playlist, x, y };
  }

  function closePlaylistContextMenu() {
    playlistContextMenu.value = null;
  }

  function openTrackContextMenu(track: Track, x: number, y: number) {
    closePlaylistContextMenu();
    trackContextMenu.value = { track, x, y };
  }

  function closeTrackContextMenu() {
    trackContextMenu.value = null;
  }

  function closeContextMenus() {
    closePlaylistContextMenu();
    closeTrackContextMenu();
  }

  function openAddToPlaylistDialog(track: Track) {
    addToPlaylistTrack.value = track;
    closeTrackContextMenu();
  }

  function closeAddToPlaylistDialog() {
    addToPlaylistTrack.value = null;
  }

  function startRenamePlaylist(playlist: UserPlaylist) {
    closePlaylistContextMenu();
    editingPlaylistId.value = playlist.id;
    newPlaylistName.value = playlist.name;
    isPlaylistDialogOpen.value = true;
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
      player.queueNext(track);
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
      player.queueLast(track);
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
    closeAddToPlaylistDialog,
    closeContextMenus,
    closeCreatePlaylistDialog,
    confirmCreatePlaylist,
    deletePlaylist,
    editingPlaylistId,
    isPlaylistDialogOpen,
    newPlaylistName,
    openAddToPlaylistDialog,
    openCreatePlaylistDialog,
    openCreatePlaylistFromAddDialog,
    openPlaylistContextMenu,
    openTrackContextMenu,
    openTrackFolder,
    playlistContextMenu,
    queueTrackLast,
    queueTrackNext,
    removeTrackFromActivePlaylist,
    startRenamePlaylist,
    trackContextMenu,
    tracksForPlaylist,
  };
}
