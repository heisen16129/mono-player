import { onBeforeUnmount } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  DESKTOP_LYRICS_ACTION_EVENT,
  DESKTOP_LYRICS_READY_EVENT,
  type DesktopLyricsAction,
} from '../services/desktopLyrics';
import type { DownloadQueueEvent } from '../services/downloads';
import { isTauriRuntime } from '../services/music';
import { listenRustBackendQueue, type RustQueueSnapshot } from '../services/playerBackend';

interface UseAppEventListenersOptions {
  onDesktopLyricsAction: (action: DesktopLyricsAction) => Promise<void> | void;
  onDesktopLyricsReady: () => void;
  onDownloadEvent: (event: DownloadQueueEvent) => void;
  onRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
}

export function useAppEventListeners({
  onDesktopLyricsAction,
  onDesktopLyricsReady,
  onDownloadEvent,
  onRustQueueSnapshot,
}: UseAppEventListenersOptions) {
  let desktopLyricsActionUnlisten: UnlistenFn | null = null;
  let desktopLyricsReadyUnlisten: UnlistenFn | null = null;
  let downloadEventUnlisten: UnlistenFn | null = null;
  let rustQueueUnlisten: UnlistenFn | null = null;

  async function startDownloadEventListener() {
    if (!isTauriRuntime() || downloadEventUnlisten) return;
    downloadEventUnlisten = await listen<DownloadQueueEvent>('download://event', (event) => {
      onDownloadEvent(event.payload);
    });
  }

  async function startDesktopLyricsActionListener() {
    if (!isTauriRuntime() || desktopLyricsActionUnlisten) return;
    desktopLyricsActionUnlisten = await listen<DesktopLyricsAction>(DESKTOP_LYRICS_ACTION_EVENT, async (event) => {
      await onDesktopLyricsAction(event.payload);
    });
  }

  async function startDesktopLyricsReadyListener() {
    if (!isTauriRuntime() || desktopLyricsReadyUnlisten) return;
    desktopLyricsReadyUnlisten = await listen(DESKTOP_LYRICS_READY_EVENT, onDesktopLyricsReady);
  }

  async function startRustQueueEventListener() {
    if (!isTauriRuntime() || rustQueueUnlisten) return;
    rustQueueUnlisten = await listenRustBackendQueue(onRustQueueSnapshot);
  }

  function stopAppEventListeners() {
    downloadEventUnlisten?.();
    downloadEventUnlisten = null;
    desktopLyricsActionUnlisten?.();
    desktopLyricsActionUnlisten = null;
    desktopLyricsReadyUnlisten?.();
    desktopLyricsReadyUnlisten = null;
    rustQueueUnlisten?.();
    rustQueueUnlisten = null;
  }

  onBeforeUnmount(stopAppEventListeners);

  return {
    startDesktopLyricsActionListener,
    startDesktopLyricsReadyListener,
    startDownloadEventListener,
    startRustQueueEventListener,
    stopAppEventListeners,
  };
}
