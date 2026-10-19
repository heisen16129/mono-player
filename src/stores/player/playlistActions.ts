import { computed, ref, type Ref } from 'vue';
import type { Track, UserPlaylist } from '../../types/music';
import * as service from '../../services/playlists';
import { getErrorMessage } from '../../utils/error';

export function createPlayerPlaylistActions({ error }: { error: Ref<string | null> }) {
  const saved = ref<UserPlaylist[]>([]);
  let pending: Promise<unknown> = Promise.resolve();
  const playlists = computed(() => saved.value);

  function reloadPlaylists() {
    const operation = pending.then(async () => { saved.value = await service.listPlaylists(); });
    pending = operation.catch(() => {});
    return operation;
  }

  function mutate(action: () => Promise<UserPlaylist[]>) {
    const operation = pending.then(async () => {
      saved.value = await action();
      return true;
    }).catch(err => {
      error.value = getErrorMessage(err);
      return false;
    });
    pending = operation;
    return operation;
  }

  return {
    playlists, reloadPlaylists,
    createPlaylist: (name: string, initialTracks: Track[] = [], cover?: string | null) => mutate(() => service.createPlaylist(name, initialTracks, cover)),
    renamePlaylist: (id: string, name: string) => mutate(() => service.renamePlaylist(id, name)),
    updatePlaylistCover: (id: string, cover: string | null) => mutate(() => service.updatePlaylistCover(id, cover)),
    deletePlaylist: (id: string) => mutate(() => service.deletePlaylist(id)),
    addTrackToPlaylist: (track: Track, id: string) => mutate(() => service.editPlaylistTracks(id, [track], true)),
    removeTrackFromPlaylist: (track: Track, id: string) => mutate(() => service.editPlaylistTracks(id, [track], false)),
  };
}
