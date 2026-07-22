import { ref } from 'vue';
import type { Track, UserPlaylist } from '../types/music';

export function useContextMenus() {
  const playlistContextMenu = ref<{ playlist: UserPlaylist; x: number; y: number } | null>(null);
  const trackContextMenu = ref<{ track: Track; x: number; y: number } | null>(null);

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

  return {
    closeContextMenus,
    closePlaylistContextMenu,
    closeTrackContextMenu,
    openPlaylistContextMenu,
    openTrackContextMenu,
    playlistContextMenu,
    trackContextMenu,
  };
}
