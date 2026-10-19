import { onMounted, type Ref } from 'vue';
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
      await loadDownloadItems();
      traceStartup('downloads-ready');
      await player.loadLibrary();
      traceStartup('library-ready');
      if (!player.currentTrack) {
        const restored = restoreSavedPlaybackSession();
        if (restored) {
          await restoreRustPlaybackQueue(restored.track, restored.currentTime);
        } else {
          rustPlaybackQueue.value = player.queue;
        }
      }
      traceStartup('queue-ready');
      await player.prepareStartupView();
      await startDesktopLyricsActionListener();
      await startDesktopLyricsReadyListener();
      await startDownloadEventListener();
      traceStartup('shell-ready');
    } finally {
      isAppReady.value = true;
    }

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
