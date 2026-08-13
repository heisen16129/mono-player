import { onBeforeUnmount, onMounted } from 'vue';
import {
  listenRustBackendAdvanced,
  listenRustBackendEnded,
  listenRustBackendError,
  listenRustBackendOutputDeviceFallback,
  listenRustBackendQueue,
  listenRustBackendState,
  type RustOutputDeviceFallbackEvent,
  type RustPlayerState,
  type RustQueueSnapshot,
} from '../services/playerBackend';

interface RustPlaybackListenersOptions {
  onAdvanced: (source: string) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onOutputDeviceFallback: (event: RustOutputDeviceFallbackEvent) => void;
  onQueue: (snapshot: RustQueueSnapshot) => void;
  onState: (state: RustPlayerState) => void;
}

export function useRustPlaybackListeners({
  onAdvanced,
  onEnded,
  onError,
  onOutputDeviceFallback,
  onQueue,
  onState,
}: RustPlaybackListenersOptions) {
  const unlisteners: Array<() => void> = [];
  let disposed = false;

  function addUnlistener(unlisten: () => void) {
    if (disposed) {
      unlisten();
      return;
    }
    unlisteners.push(unlisten);
  }

  onMounted(async () => {
    addUnlistener(await listenRustBackendAdvanced(onAdvanced));
    addUnlistener(await listenRustBackendState(onState));
    addUnlistener(await listenRustBackendQueue(onQueue));
    addUnlistener(await listenRustBackendOutputDeviceFallback(onOutputDeviceFallback));
    addUnlistener(await listenRustBackendError(onError));
    addUnlistener(await listenRustBackendEnded(onEnded));
  });

  onBeforeUnmount(() => {
    disposed = true;
    for (const unlisten of unlisteners.splice(0)) {
      unlisten();
    }
  });
}
