import { onBeforeUnmount, ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../services/music';

export function useLyricsFullscreen() {
  const isFullscreen = ref(false);
  let restoreMaximizedAfterFullscreen = false;

  async function updateFullscreenState() {
    if (!isTauriRuntime()) return;
    isFullscreen.value = await getCurrentWindow().isFullscreen();
  }

  async function closeFullscreenIfNeeded() {
    if (!isTauriRuntime() || !isFullscreen.value) return;
    const appWindow = getCurrentWindow();
    await appWindow.setFullscreen(false);
    isFullscreen.value = false;
    if (restoreMaximizedAfterFullscreen) {
      await appWindow.maximize();
      restoreMaximizedAfterFullscreen = false;
    }
  }

  async function toggleLyricsFullscreen() {
    if (!isTauriRuntime()) return;
    const appWindow = getCurrentWindow();
    const currentlyFullscreen = await appWindow.isFullscreen();

    if (currentlyFullscreen) {
      await closeFullscreenIfNeeded();
      return;
    }

    restoreMaximizedAfterFullscreen = await appWindow.isMaximized();
    if (restoreMaximizedAfterFullscreen) {
      await appWindow.unmaximize();
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
    await appWindow.setFullscreen(true);
    isFullscreen.value = true;
  }

  onBeforeUnmount(() => {
    if (isTauriRuntime() && isFullscreen.value) {
      void getCurrentWindow().setFullscreen(false).then(() => {
        if (restoreMaximizedAfterFullscreen) {
          return getCurrentWindow().maximize();
        }
        return undefined;
      });
    }
  });

  return {
    closeFullscreenIfNeeded,
    isFullscreen,
    toggleLyricsFullscreen,
    updateFullscreenState,
  };
}
