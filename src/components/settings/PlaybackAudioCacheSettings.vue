<script setup lang="ts">
import { onMounted } from 'vue';
import { useAudioCacheSettings } from '../../composables/useAudioCacheSettings';
import PlaybackAudioCacheDirectorySetting from './PlaybackAudioCacheDirectorySetting.vue';
import PlaybackAudioCacheManagement from './PlaybackAudioCacheManagement.vue';
import CacheDirectoryBreakdown from './CacheDirectoryBreakdown.vue';
import GeneralDownloadDirectorySetting from './GeneralDownloadDirectorySetting.vue';

const props = defineProps<{
  audioCacheDir: string;
  audioCacheMaxMb: number;
  downloadDir: string;
  setDownloadDir: (downloadDir: string) => void;
  locale: string;
  setAudioCacheDir: (cacheDir: string) => void;
  setAudioCacheMaxMb: (value: number) => void;
}>();

const {
  cacheCleanupMessage,
  cacheUsedLabel,
  cacheStatus,
  chooseAudioCacheDir,
  useDefaultCacheDir,
  useSystemTempCacheDir,
  clearAudioCache,
  refreshCacheStatus,
} = useAudioCacheSettings({
  getAudioCacheMaxMb: () => props.audioCacheMaxMb,
  setAudioCacheDir: props.setAudioCacheDir,
});

onMounted(() => {
  void refreshCacheStatus();
});
</script>

<template>
  <details class="cache-storage" open>
    <summary>
      <span>{{ locale === 'en-US' ? 'Storage & cache' : '存储与缓存' }}</span>
      <small>{{ locale === 'en-US' ? 'Download location and cache usage' : '下载位置与缓存占用' }}</small>
    </summary>
    <div class="cache-storage-body">
  <GeneralDownloadDirectorySetting
    :download-dir="downloadDir"
    :locale="locale"
    :set-download-dir="setDownloadDir"
  />

      <div class="cache-overview">
        <strong>{{ locale === 'en-US' ? 'Cache directory' : '缓存目录' }}</strong>
        <strong>{{ locale === 'en-US' ? 'Used' : '已占用' }} {{ cacheUsedLabel }}</strong>
      </div>
      <small class="cache-file-count">{{ cacheStatus.files }} {{ locale === 'en-US' ? 'cached files' : '个缓存文件' }}</small>
  <PlaybackAudioCacheDirectorySetting
    :audio-cache-dir="audioCacheDir"
    :choose-audio-cache-dir="chooseAudioCacheDir"
    :use-default-cache-dir="useDefaultCacheDir"
    :use-system-temp-cache-dir="useSystemTempCacheDir"
    :locale="locale"
    :set-audio-cache-dir="setAudioCacheDir"
  />


  <CacheDirectoryBreakdown :directories="cacheStatus.directories" :locale="locale" />

  <PlaybackAudioCacheManagement
    :audio-cache-max-mb="audioCacheMaxMb"
    :cache-cleanup-message="cacheCleanupMessage"
    :cache-used-label="cacheUsedLabel"
    :clear-audio-cache="clearAudioCache"
    :locale="locale"
    :refresh-cache-status="refreshCacheStatus"
    :set-audio-cache-max-mb="setAudioCacheMaxMb"
  />
    </div>
  </details>
</template>

<style scoped>
.cache-storage {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

summary {
  position: relative;
  padding-right: 20px;
  list-style: none;
  cursor: pointer;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
}

summary::-webkit-details-marker { display: none; }
summary::after { content: '▸'; position: absolute; right: 0; top: 0; }
.cache-storage[open] > summary::after { content: '▾'; }
summary small {
  display: block;
  margin-top: 3px;
  color: var(--smw-text-secondary);
  font-size: 11px;
  font-weight: 400;
}

.cache-storage-body {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 9px;
  background: var(--smw-bg-input);
}

.cache-overview {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--smw-text-body);
  font-size: 12px;
}

.cache-overview strong {
  font-weight: 650;
}

.cache-file-count {
  color: var(--smw-text-secondary);
  font-size: 11px;
}
</style>
