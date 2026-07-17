import { computed, ref, type Ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { resolveLocale } from '../i18n';
import { cancelScanMusicDir, isTauriRuntime } from '../services/music';
import type { usePlayerStore } from '../stores/player';
import { getErrorMessage } from '../utils/error';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface ScanFoldersOptions {
  activeFolderPath: Ref<string | null>;
  player: PlayerStore;
}

export function useScanFolders({ activeFolderPath, player }: ScanFoldersOptions) {
  const isScanDialogOpen = ref(false);
  const isConfirmingScan = ref(false);
  const scanFolders = ref<{ path: string; checked: boolean }[]>([]);
  const pendingRecentFolderPath = ref<string | null>(null);
  const currentScanFolder = ref('');
  const scannedTrackCount = ref(0);
  const completedFolderCount = ref(0);
  const totalFolderCount = ref(0);
  const isCancelingScan = ref(false);
  let scanCanceled = false;
  let unlistenScanTrack: UnlistenFn | null = null;
  let unlistenScanDone: UnlistenFn | null = null;

  const scanProgressText = computed(() => {
    if (!isConfirmingScan.value) return '';
    const folderProgress = totalFolderCount.value > 1
      ? `${completedFolderCount.value + 1}/${totalFolderCount.value} - `
      : '';
    const label = resolveLocale(player.settings.locale) === 'en-US' ? 'tracks scanned' : '首歌曲已扫描';
    const folder = currentScanFolder.value.split(/[\\/]/).pop() || currentScanFolder.value;
    return `${folderProgress}${scannedTrackCount.value} ${label}${folder ? ` - ${folder}` : ''}`;
  });

  function localScanUnavailableMessage() {
    return resolveLocale(player.settings.locale) === 'en-US'
      ? 'Folder selection and local scanning are available in the Tauri desktop window.'
      : '本地扫描仅可在 Tauri 桌面窗口中使用。';
  }

  async function chooseFolder() {
    if (!isTauriRuntime()) {
      player.error = localScanUnavailableMessage();
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: resolveLocale(player.settings.locale) === 'en-US' ? 'Select music folder' : '选择音乐文件夹',
    });

    if (typeof selected === 'string') {
      await player.scanLibrary(selected);
    }
  }

  function openScanDialog() {
    const musicDirs = Array.isArray(player.settings.musicDirs) ? player.settings.musicDirs : [];
    scanFolders.value = musicDirs.map((path) => ({ path, checked: false }));
    pendingRecentFolderPath.value = null;
    isScanDialogOpen.value = true;
  }

  function closeScanDialog() {
    if (isConfirmingScan.value) return;
    isScanDialogOpen.value = false;
  }

  async function addScanFolder() {
    if (isConfirmingScan.value) return;
    if (!isTauriRuntime()) {
      player.error = localScanUnavailableMessage();
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: resolveLocale(player.settings.locale) === 'en-US' ? 'Add scan folder' : '添加扫描文件夹',
    });

    if (typeof selected !== 'string') return;
    if (scanFolders.value.some((folder) => folder.path === selected)) return;
    pendingRecentFolderPath.value = selected;
    scanFolders.value = [...scanFolders.value, { path: selected, checked: true }];
  }

  async function removeScanFolder(path: string) {
    if (isConfirmingScan.value) return;
    scanFolders.value = scanFolders.value.filter((folder) => folder.path !== path);
    await player.setMusicDirs(scanFolders.value.map((folder) => folder.path));
    if (activeFolderPath.value === path) {
      activeFolderPath.value = null;
    }
  }

  function updateScanFolderChecked(path: string, checked: boolean) {
    scanFolders.value = scanFolders.value.map((folder) => {
      return folder.path === path ? { ...folder, checked } : folder;
    });
  }

  async function confirmScanFolders() {
    if (isConfirmingScan.value) return;

    const folders = scanFolders.value.filter((folder) => folder.checked).map((folder) => folder.path);
    await player.setMusicDirs(scanFolders.value.map((folder) => folder.path));

    if (folders.length === 0) {
      isScanDialogOpen.value = false;
      return;
    }

    isConfirmingScan.value = true;
    isCancelingScan.value = false;
    scanCanceled = false;
    completedFolderCount.value = 0;
    totalFolderCount.value = folders.length;

    try {
      for (const folder of folders) {
        if (scanCanceled) break;
        currentScanFolder.value = folder;
        scannedTrackCount.value = 0;
        await startScanProgressListeners();
        try {
          await player.scanLibrary(folder);
        } catch (err) {
          const message = getErrorMessage(err);
          if (message.includes('Scan canceled')) {
            scanCanceled = true;
            break;
          }
          throw err;
        }
        stopScanProgressListeners();
        completedFolderCount.value += 1;
      }
      if (!scanCanceled) {
        isScanDialogOpen.value = false;
      }
      pendingRecentFolderPath.value = null;
    } finally {
      stopScanProgressListeners();
      isConfirmingScan.value = false;
      isCancelingScan.value = false;
      currentScanFolder.value = '';
      scannedTrackCount.value = 0;
      completedFolderCount.value = 0;
      totalFolderCount.value = 0;
    }
  }

  async function cancelScanFolders() {
    if (!isConfirmingScan.value || isCancelingScan.value) return;
    scanCanceled = true;
    isCancelingScan.value = true;
    try {
      await cancelScanMusicDir();
    } catch (err) {
      player.error = getErrorMessage(err);
    }
  }

  async function startScanProgressListeners() {
    if (!isTauriRuntime()) return;
    stopScanProgressListeners();
    unlistenScanTrack = await listen('scan://track', () => {
      scannedTrackCount.value += 1;
    });
    unlistenScanDone = await listen<number>('scan://done', (event) => {
      scannedTrackCount.value = Math.max(scannedTrackCount.value, event.payload);
    });
  }

  function stopScanProgressListeners() {
    unlistenScanTrack?.();
    unlistenScanDone?.();
    unlistenScanTrack = null;
    unlistenScanDone = null;
  }

  return {
    addScanFolder,
    cancelScanFolders,
    chooseFolder,
    closeScanDialog,
    confirmScanFolders,
    isConfirmingScan,
    isCancelingScan,
    isScanDialogOpen,
    openScanDialog,
    removeScanFolder,
    scanFolders,
    scanProgressText,
    updateScanFolderChecked,
  };
}
