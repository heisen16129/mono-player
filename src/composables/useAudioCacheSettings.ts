import { computed, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import {
  clearRustBackendCache,
  getRustBackendCacheStatus,
  getRustBackendDefaultCacheDir,
  getRustBackendSystemTempCacheDir,
  pruneRustBackendCache,
} from '../services/playerBackend';

interface UseAudioCacheSettingsOptions {
  getAudioCacheMaxMb: () => number;
  setAudioCacheDir: (cacheDir: string) => void;
}

export function useAudioCacheSettings({ getAudioCacheMaxMb, setAudioCacheDir }: UseAudioCacheSettingsOptions) {
  const cacheCleanupMessage = ref('');
  const cacheStatus = ref({ files: 0, bytes: 0 });
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

  async function useSystemTempCacheDir() {
    const cacheDir = await getRustBackendSystemTempCacheDir();
    setAudioCacheDir(cacheDir);
  }

  async function useDefaultCacheDir() {
    const cacheDir = await getRustBackendDefaultCacheDir();
    setAudioCacheDir(cacheDir);
  }

  async function clearAudioCache() {
    const result = await clearRustBackendCache();
    await refreshCacheStatus();
    cacheCleanupMessage.value = `已清理 ${result.removedFiles} 个文件，释放 ${(result.removedBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function pruneAudioCache() {
    const result = await pruneRustBackendCache(getAudioCacheMaxMb() * 1024 * 1024);
    cacheCleanupMessage.value = `已按上限清理 ${result.removedFiles} 个文件，当前约 ${(result.remainingBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function refreshCacheStatus() {
    cacheStatus.value = await getRustBackendCacheStatus();
  }

  return {
    cacheCleanupMessage,
    cacheStatus,
    cacheUsedLabel,
    chooseAudioCacheDir,
    clearAudioCache,
    pruneAudioCache,
    refreshCacheStatus,
    useDefaultCacheDir,
    useSystemTempCacheDir,
  };
}
