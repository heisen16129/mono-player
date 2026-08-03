import { computed, type Ref } from 'vue';
import type { Track } from '../../types/music';
import { isFavoriteTrack, resolveFavoriteTracks, toggleFavoriteTrack } from './favorites';

interface PlayerFavoriteActionsOptions {
  favoriteTrackIds: Ref<number[]>;
  favoriteTrackSnapshots: Ref<Track[]>;
  persistFavorites: () => void;
  tracks: Ref<Track[]>;
}

export function createPlayerFavoriteActions({
  favoriteTrackIds,
  favoriteTrackSnapshots,
  persistFavorites,
  tracks,
}: PlayerFavoriteActionsOptions) {
  const favoriteTracks = computed(() => {
    return resolveFavoriteTracks(favoriteTrackIds.value, tracks.value, favoriteTrackSnapshots.value);
  });

  function isFavorite(track: Track | null) {
    return isFavoriteTrack(track, favoriteTrackIds.value, favoriteTrackSnapshots.value, tracks.value);
  }

  function toggleFavorite(track: Track | null) {
    if (!track) return false;

    const result = toggleFavoriteTrack(track, favoriteTrackIds.value, favoriteTrackSnapshots.value, tracks.value);
    favoriteTrackIds.value = result.favoriteIds;
    favoriteTrackSnapshots.value = result.snapshots;
    persistFavorites();
    return result.isFavorite;
  }

  return {
    favoriteTracks,
    isFavorite,
    toggleFavorite,
  };
}
