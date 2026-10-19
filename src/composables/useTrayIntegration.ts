import { onBeforeUnmount, onMounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exitApp, hideMainWindowToTray, isTauriRuntime } from '../services/music';
import type { usePlayerStore } from '../stores/player';


type PlayerStore = ReturnType<typeof usePlayerStore>;

interface TrayIntegrationOptions {
  handleTrayMenuAction: (action: string) => void | Promise<void>;
  player: PlayerStore;
}

export function useTrayIntegration({
  handleTrayMenuAction,
  player,
}: TrayIntegrationOptions) {
  let unlistenCloseRequested: (() => void) | null = null;
  let unlistenTrayMenu: UnlistenFn | null = null;

  async function handleAppCloseRequest() {
    if (!isTauriRuntime()) return;

    if (player.settings.closeAction === 'tray') {
      await hideMainWindowToTray();
      return;
    }

    await exitApp();
  }

  onMounted(async () => {
    if (!isTauriRuntime()) return;

    unlistenCloseRequested = await getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await handleAppCloseRequest();
    });

    unlistenTrayMenu = await listen<string>('tray-menu-action', async (event) => {
      await handleTrayMenuAction(event.payload);
    });
  });

  onBeforeUnmount(() => {
    unlistenCloseRequested?.();
    unlistenCloseRequested = null;
    unlistenTrayMenu?.();
    unlistenTrayMenu = null;
  });

  return {
    handleAppCloseRequest,
  };
}
