import { onMounted, onUnmounted, watch } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime, listTracks } from '../services/music';
import { readPersistentValue } from '../services/persistentStore';
import { usePlayerStore } from '../stores/player';
import { normalizeSettings } from '../stores/player/settingsNormalizers';
import { invokeApi } from '../services/api';

// Refresh only library data changed by the speaker, preserving the local playback queue.
export function useMiotLibrarySync() {
  const player = usePlayerStore();
  let unlisten: UnlistenFn | undefined;
  let disposed = false;
  let pending: Promise<void> = Promise.resolve();
  watch(() => player.settings.enablePlugins, () => {
    if (isTauriRuntime()) void invokeApi('miot_sync').catch(error => console.warn('[Miot]', error));
  });
  onMounted(async () => {
    if (!isTauriRuntime()) return;
    unlisten = await listen('miot-library-changed', () => {
      pending = pending.then(async () => {
        const [settings, favorites, recent, tracks] = await Promise.all([
          readPersistentValue('mono-player-settings'),
          readPersistentValue<{ ids: number[]; tracks: typeof player.tracks }>('mono-player-favorites'),
          readPersistentValue<number[]>('mono-player-recent-played-track-ids'), listTracks(),
        ]);
        if (disposed) return;
        if (settings) player.settings.playlists = normalizeSettings(settings).playlists;
        if (favorites?.ids) player.refreshExternalFavorites(favorites.ids, favorites.tracks || []);
        if (recent) player.recentPlayedTrackIds = recent;
        player.tracks = tracks;
      }).catch(error => { console.warn('[Miot] 曲库同步失败', error); });
    });
    if (disposed) unlisten();
  });
  onUnmounted(() => { disposed = true; unlisten?.(); });
}
