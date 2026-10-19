import { invokeApi } from './api';
import type { FavoriteList } from '../types/favorite';
import type { Track } from '../types/music';

export const listFavorites = () => invokeApi<FavoriteList>('list_favorites');
export const addFavorite = (track: Track) => invokeApi<FavoriteList>('add_favorite', { track });
export const removeFavorite = (id: number) => invokeApi<FavoriteList>('remove_favorite', { id });
