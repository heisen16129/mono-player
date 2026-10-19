import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../services/music';
import { open } from '@tauri-apps/plugin-dialog';
import {
  clearRustBackendCache,
  getRustBackendCacheStatus,
  getRustBackendDefaultCacheDir,
  getRustBackendSystemTempCacheDir,
  type RustCacheStatusState,
} from '../services/playerBackend';

interface UseAudioCacheSettingsOptions {
  setAudioCacheDir: (cacheDir: string) => void;
}

export function useAudioCacheSettings({ setAudioCacheDir }: UseAudioCacheSettingsOptions) {
  let disposed = false;
  let unlisten: (() => void) | undefined;
  onMounted(async () => {
    if (!isTauriRuntime()) return;
    const stop = await listen('cache://changed', () => { void refreshCacheStatus(); });
    if (disposed) stop();
    else unlisten = stop;
  });
  onBeforeUnmount(() => { disposed = true; unlisten?.(); });

  const cacheCleanupMessage = ref('');
  const cacheStatus = ref<RustCacheStatusState>({ files: 0, bytes: 0, path: '', directories: [] });
  const cacheUsedLabel = computed(() => `${(cacheStatus.value.bytes / 1024 / 1024).toFixed(1)} MB`);

  async function chooseAudioCacheDir() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择音频临时缓存目录',
    });

    if (typeof selected === 'string') {
      setAudioCacheDir(selected);
    }
  }

  async function clearAudioCache() {
    const result = await clearRustBackendCache();
    await refreshCacheStatus();
    cacheCleanupMessage.value = `已清理 ${result.removedFiles} 个文件，释放 ${(result.removedBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function useDefaultCacheDir() {
    setAudioCacheDir(await getRustBackendDefaultCacheDir());
  }

  async function useSystemTempCacheDir() {
    setAudioCacheDir(await getRustBackendSystemTempCacheDir());
  }

  async function refreshCacheStatus() {
    cacheStatus.value = await getRustBackendCacheStatus();
  }

  return {
    cacheCleanupMessage,
    cacheStatus,
    cacheUsedLabel,
    chooseAudioCacheDir,
    useDefaultCacheDir,
    useSystemTempCacheDir,
    clearAudioCache,
    refreshCacheStatus,
  };
}
