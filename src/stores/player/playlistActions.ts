import type { Ref } from 'vue';
import type { PlayerSettings, Track } from '../../types/music';
import {
  addTrackToPlaylistEntry,
  createPlaylistEntry,
  deletePlaylistEntry,
  removeTrackFromPlaylistEntry,
  renamePlaylistEntry,
} from './playlists';

interface PlayerPlaylistActionsOptions {
  persistSettings: () => void;
  settings: Ref<PlayerSettings>;
  tracks: Ref<Track[]>;
}

export function createPlayerPlaylistActions({ persistSettings, settings, tracks }: PlayerPlaylistActionsOptions) {
  function createPlaylist(name: string, initialTracks: Array<number | Track> = []) {
    const result = createPlaylistEntry(settings.value.playlists, name, initialTracks, tracks.value, Date.now());
    if (!result.created) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function renamePlaylist(playlistId: string, name: string) {
    const result = renamePlaylistEntry(settings.value.playlists, playlistId, name);
    if (!result.renamed) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function deletePlaylist(playlistId: string) {
    const result = deletePlaylistEntry(settings.value.playlists, playlistId);
    if (!result.deleted) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function addTrackToPlaylist(track: Track, playlistId: string) {
    const result = addTrackToPlaylistEntry(settings.value.playlists, playlistId, track, tracks.value);
    if (!result.added) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  function removeTrackFromPlaylist(track: Track, playlistId: string) {
    const result = removeTrackFromPlaylistEntry(settings.value.playlists, playlistId, track);
    if (!result.removed) return false;

    settings.value.playlists = result.playlists;
    persistSettings();
    return true;
  }

  return {
    addTrackToPlaylist,
    createPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    renamePlaylist,
  };
}
