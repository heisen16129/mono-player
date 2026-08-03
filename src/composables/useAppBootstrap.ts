import { onMounted, type Ref } from 'vue';
import { getRustBackendDefaultCacheDir, setRustBackendCacheDir } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';

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
  startMcpSleepTimerListener: () => Promise<void>;
  startRustQueueEventListener: () => Promise<void>;
  startSystemMediaActionListener: () => Promise<void>;
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
  startMcpSleepTimerListener,
  startRustQueueEventListener,
  startSystemMediaActionListener,
}: UseAppBootstrapOptions) {
  async function initializeApp() {
    try {
      await player.hydratePersistedState();
      if (!player.settings.audioCacheDir) {
        const defaultCacheDir = await getRustBackendDefaultCacheDir();
        if (defaultCacheDir) {
          player.setAudioCacheDir(defaultCacheDir);
        }
      }
      await setRustBackendCacheDir(player.settings.audioCacheDir || null);
      await loadLibraryPanelWidth();
      await loadDownloadItems();
      await player.loadLibrary();
      const restored = restoreSavedPlaybackSession();
      if (restored) {
        await restoreRustPlaybackQueue(restored.track, restored.currentTime);
      } else {
        rustPlaybackQueue.value = dedupePlaybackQueue(player.queue.filter((track) => track.path));
      }
    } finally {
      isAppReady.value = true;
    }

    await startDesktopLyricsActionListener();
    await startDesktopLyricsReadyListener();
    await startDownloadEventListener();
    await startMcpSleepTimerListener();
    await startRustQueueEventListener();
    await startSystemMediaActionListener();
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
