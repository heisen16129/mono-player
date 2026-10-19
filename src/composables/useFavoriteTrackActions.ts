import { computed } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import type { LibraryCollection } from './useLibraryNavigation';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseFavoriteTrackActionsOptions {
  activeCollection: ReadonlyRefValue<LibraryCollection>;
  activePlaylistId: ReadonlyRefValue<string | null>;
  activeTrack: ReadonlyRefValue<Track | null>;
  player: ReturnType<typeof usePlayerStore>;
  closeContextMenus: () => void;
  removeTrackFromRustQueue: (track: Track) => Promise<void> | void;
}

export function useFavoriteTrackActions({
  activeCollection,
  activePlaylistId,
  activeTrack,
  player,
  closeContextMenus,
  removeTrackFromRustQueue,
}: UseFavoriteTrackActionsOptions) {
  const isActiveTrackFavorite = computed(() => player.isFavorite(activeTrack.value));

  function syncRemovedFavoriteTrack(track: Track | null) {
    if (!track || activeCollection.value !== 'favorites' || activePlaylistId.value) return;
    void removeTrackFromRustQueue(track);
  }

  async function toggleFavoriteTrack() {
    const track = activeTrack.value;
    const isFavorite = await player.toggleFavorite(track);
    if (isFavorite === false) syncRemovedFavoriteTrack(track);
  }

  async function toggleFavoriteForTrack(track: Track) {
    const isFavorite = await player.toggleFavorite(track);
    if (isFavorite === false) syncRemovedFavoriteTrack(track);
  }

  function addTrackToFavorites(track: Track) {
    void player.addFavoriteTrack(track);
    closeContextMenus();
  }

  return {
    addTrackToFavorites,
    isActiveTrackFavorite,
    toggleFavoriteForTrack,
    toggleFavoriteTrack,
  };
}
