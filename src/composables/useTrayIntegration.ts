import { computed, onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exitApp, hideMainWindowToTray, isTauriRuntime, updateTrayNowPlaying } from '../services/music';
import { writePersistentValue } from '../services/persistentStore';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

const TRAY_STATE_KEY = 'mono-player-tray-state';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface TrayIntegrationOptions {
  activeTrack: ComputedRef<Track | null>;
  handleTrayMenuAction: (action: string) => void | Promise<void>;
  isAudioPlaying: Ref<boolean>;
  player: PlayerStore;
  savePlaybackSessionNow: () => void;
}

export function useTrayIntegration({
  activeTrack,
  handleTrayMenuAction,
  isAudioPlaying,
  player,
  savePlaybackSessionNow,
}: TrayIntegrationOptions) {
  let unlistenCloseRequested: (() => void) | null = null;
  let unlistenTrayMenu: UnlistenFn | null = null;

  const trayNowPlayingTitle = computed(() => {
    if (!activeTrack.value) return 'Mono Player';
    return [activeTrack.value.title, activeTrack.value.artist].filter(Boolean).join(' - ');
  });

  const trayState = computed(() => ({
    title: activeTrack.value?.title || 'Mono Player',
    artist: activeTrack.value?.artist || '',
    isPlaying: isAudioPlaying.value,
  }));

  async function handleAppCloseRequest() {
    if (!isTauriRuntime()) return;

    savePlaybackSessionNow();
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

  watch(
    trayNowPlayingTitle,
    async (title) => {
      if (!isTauriRuntime()) return;
      await updateTrayNowPlaying(title);
    },
    { immediate: true },
  );

  watch(
    trayState,
    (state) => {
      void writePersistentValue(TRAY_STATE_KEY, state);
    },
    { immediate: true },
  );

  return {
    handleAppCloseRequest,
    trayNowPlayingTitle,
  };
}
