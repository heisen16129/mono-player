import { onMounted, type Ref } from 'vue';
import { getRustBackendDefaultCacheDir, setRustBackendCacheDir } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import { traceStartup } from '../services/startup';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface RestoredPlaybackSession {
  currentTime: number;
  track: Track;
}

interface UseAppBootstrapOptions {
  dedupePlaybackQueue: (tracks: Track[]) => Track[];
  isAppReady: Ref<boolean>;
  loadDownloadItems: () => Promise<void>;
  loadLibraryPanelWidth: () => Promise<void>;
  player: PlayerStore;
  restoreRustPlaybackQueue: (track: Track, currentTime: number) => Promise<void>;
  restoreSavedPlaybackSession: () => RestoredPlaybackSession | null;
  rustPlaybackQueue: Ref<Track[]>;
  startDesktopLyricsActionListener: () => Promise<void>;
  startDesktopLyricsReadyListener: () => Promise<void>;
  startDownloadEventListener: () => Promise<void>;
  startRustQueueEventListener: () => Promise<void>;
}

export function useAppBootstrap({
  dedupePlaybackQueue,
  isAppReady,
  loadDownloadItems,
  loadLibraryPanelWidth,
  player,
  restoreRustPlaybackQueue,
  restoreSavedPlaybackSession,
  rustPlaybackQueue,
  startDesktopLyricsActionListener,
  startDesktopLyricsReadyListener,
  startDownloadEventListener,
  startRustQueueEventListener,
}: UseAppBootstrapOptions) {
  async function initializeApp() {
    traceStartup('bootstrap-start');
    try {
      await player.hydratePersistedState();
      traceStartup('preferences-ready');
      await loadLibraryPanelWidth();
      await startRustQueueEventListener();
      // The shell only needs persisted preferences; library and queue restoration can follow.
      isAppReady.value = true;
      traceStartup('shell-ready');
      if (!player.settings.audioCacheDir) {
        const defaultCacheDir = await getRustBackendDefaultCacheDir();
        if (defaultCacheDir) {
          player.setAudioCacheDir(defaultCacheDir);
        }
      }
      traceStartup('cache-dir-start');
      await setRustBackendCacheDir(player.settings.audioCacheDir || null);
      traceStartup('cache-dir-ready');
      await loadDownloadItems();
      traceStartup('downloads-ready');
      await player.loadLibrary();
      traceStartup('library-ready');
      if (!player.currentTrack) {
        const restored = restoreSavedPlaybackSession();
        if (restored) {
          await restoreRustPlaybackQueue(restored.track, restored.currentTime);
        } else {
          rustPlaybackQueue.value = dedupePlaybackQueue(player.queue.filter((track) => track.path));
        }
      }
      traceStartup('queue-ready');
    } finally {
      isAppReady.value = true;
    }

    await startDesktopLyricsActionListener();
    await startDesktopLyricsReadyListener();
    await startDownloadEventListener();
  }

  onMounted(() => {
    void initializeApp().catch((error) => {
      player.error = getErrorMessage(error);
      isAppReady.value = true;
    });
  });

  return {
    initializeApp,
  };
}
