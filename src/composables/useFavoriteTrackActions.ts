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

  function toggleFavoriteTrack() {
    const track = activeTrack.value;
    const wasFavorite = player.isFavorite(track);
    player.toggleFavorite(track);
    if (wasFavorite) syncRemovedFavoriteTrack(track);
  }

  function toggleFavoriteForTrack(track: Track) {
    const wasFavorite = player.isFavorite(track);
    player.toggleFavorite(track);
    if (wasFavorite) syncRemovedFavoriteTrack(track);
  }

  function addTrackToFavorites(track: Track) {
    if (!player.isFavorite(track)) {
      player.toggleFavorite(track);
    }
    closeContextMenus();
  }

  return {
    addTrackToFavorites,
    isActiveTrackFavorite,
    toggleFavoriteForTrack,
    toggleFavoriteTrack,
  };
}
