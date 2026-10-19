import { onMounted, onUnmounted, watch } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime, listTracks } from '../services/music';
import { usePlayerStore } from '../stores/player';
import { invokeApi } from '../services/api';

// Refresh only library data changed by the speaker, preserving the local playback queue.
export function useMiotLibrarySync() {
  const player = usePlayerStore();
  let unlisten: UnlistenFn | undefined;
  let unlistenFavorites: UnlistenFn | undefined;
  let unlistenPlaylists: UnlistenFn | undefined;
  let unlistenRecent: UnlistenFn | undefined;
  let disposed = false;
  let pending: Promise<void> = Promise.resolve();
  watch(() => player.settings.enablePlugins, () => {
    if (isTauriRuntime()) void invokeApi('miot_sync').catch(error => console.warn('[Miot]', error));
  });
  onMounted(async () => {
    if (!isTauriRuntime()) return;
    unlisten = await listen('miot-library-changed', () => {
      pending = pending.then(async () => {
        const [tracks] = await Promise.all([
          listTracks(), player.reloadRecentlyPlayed(),
          player.reloadFavorites(), player.reloadPlaylists(),
        ]);
        if (disposed) return;
        player.tracks = tracks;
      }).catch(error => { console.warn('[Miot] 曲库同步失败', error); });
    });
    unlistenFavorites = await listen('favorites-changed', () => {
      void player.reloadFavorites().catch(error => console.warn('[Favorites]', error));
    });
    unlistenPlaylists = await listen('playlists-changed', () => {
      void player.reloadPlaylists().catch(error => console.warn('[Playlists]', error));
    });
    unlistenRecent = await listen('recently-played-changed', () => {
      void player.reloadRecentlyPlayed().catch(error => console.warn('[Recently played]', error));
    });
    if (disposed) { unlisten(); unlistenFavorites(); unlistenPlaylists(); unlistenRecent(); }
  });
  onUnmounted(() => { disposed = true; unlisten?.(); unlistenFavorites?.(); unlistenPlaylists?.(); unlistenRecent?.(); });
}
