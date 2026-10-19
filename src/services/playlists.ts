import { invokeApi } from './api';
import type { Track, UserPlaylist } from '../types/music';

export const listPlaylists = () => invokeApi<UserPlaylist[]>('list_playlists');
export const createPlaylist = (name: string, tracks: Track[], cover?: string | null) => invokeApi<UserPlaylist[]>('create_playlist', { name, tracks, cover: cover ?? null });
export const renamePlaylist = (id: string, name: string) => invokeApi<UserPlaylist[]>('rename_playlist', { id, name });
export const updatePlaylistCover = (id: string, cover: string | null) => invokeApi<UserPlaylist[]>('update_playlist_cover', { id, cover });
export const deletePlaylist = (id: string) => invokeApi<UserPlaylist[]>('delete_playlist', { id });
export const editPlaylistTracks = (id: string, tracks: Track[], add: boolean) => invokeApi<UserPlaylist[]>('edit_playlist_tracks', { id, tracks, add });
