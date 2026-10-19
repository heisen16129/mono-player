import { computed, ref, type Ref } from 'vue';
import type { Track } from '../../types/music';
import type { FavoriteList } from '../../types/favorite';
import { addFavorite, listFavorites, removeFavorite } from '../../services/favorites';
import { favoriteIdentity } from '../../utils/favoriteIdentity';
import { getErrorMessage } from '../../utils/error';

interface PlayerFavoriteActionsOptions {
  error: Ref<string | null>;
}

export function createPlayerFavoriteActions({ error }: PlayerFavoriteActionsOptions) {
  const result = ref<FavoriteList>({ items: [], statistics: { count: 0, totalSeconds: 0 } });
  const favorites = computed(() => result.value.items);
  const favoriteStatistics = computed(() => result.value.statistics);
  let pending: Promise<unknown> = Promise.resolve();
  const byIdentity = computed(() => new Map(favorites.value.map(item => [item.identityKey, item])));
  const favoriteTracks = computed(() => favorites.value.map(item => item.track));
  const favoriteTrackIds = computed(() => favoriteTracks.value.map(track => track.id));

  function isFavorite(track: Track | null) {
    return Boolean(track && byIdentity.value.has(favoriteIdentity(track)));
  }

  function reloadFavorites() {
    const operation = pending.then(async () => { result.value = await listFavorites(); });
    pending = operation.catch(() => {});
    return operation;
  }

  function updateFavorite(track: Track | null, desired?: boolean): Promise<boolean | undefined> {
    if (!track) return Promise.resolve(undefined);
    const operation = pending.then(async () => {
      const existing = byIdentity.value.get(favoriteIdentity(track));
      const next = desired ?? !existing;
      if (next === Boolean(existing)) return next;
      result.value = next ? await addFavorite(track) : await removeFavorite(existing!.id);
      return next;
    }).catch(err => {
      error.value = getErrorMessage(err);
      return undefined;
    });
    pending = operation;
    return operation;
  }

  return {
    favoriteStatistics, favoriteTracks, favoriteTrackIds, isFavorite, reloadFavorites,
    toggleFavorite: (track: Track | null) => updateFavorite(track),
    addFavoriteTrack: (track: Track) => updateFavorite(track, true),
  };
}
