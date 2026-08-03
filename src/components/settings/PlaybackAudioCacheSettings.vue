<script setup lang="ts">
import { onMounted } from 'vue';
import { useAudioCacheSettings } from '../../composables/useAudioCacheSettings';
import PlaybackAudioCacheDirectorySetting from './PlaybackAudioCacheDirectorySetting.vue';
import PlaybackAudioCacheManagement from './PlaybackAudioCacheManagement.vue';

const props = defineProps<{
  audioCacheDir: string;
  audioCacheMaxMb: number;
  locale: string;
  setAudioCacheDir: (cacheDir: string) => void;
  setAudioCacheMaxMb: (value: number) => void;
}>();

const {
  cacheCleanupMessage,
  cacheUsedLabel,
  chooseAudioCacheDir,
  clearAudioCache,
  refreshCacheStatus,
  useDefaultCacheDir,
  useSystemTempCacheDir,
} = useAudioCacheSettings({
  getAudioCacheMaxMb: () => props.audioCacheMaxMb,
  setAudioCacheDir: props.setAudioCacheDir,
});

onMounted(() => {
  void refreshCacheStatus();
});
</script>

<template>
  <PlaybackAudioCacheDirectorySetting
    :audio-cache-dir="audioCacheDir"
    :choose-audio-cache-dir="chooseAudioCacheDir"
    :locale="locale"
    :set-audio-cache-dir="setAudioCacheDir"
    :use-default-cache-dir="useDefaultCacheDir"
    :use-system-temp-cache-dir="useSystemTempCacheDir"
  />

  <PlaybackAudioCacheManagement
    :audio-cache-max-mb="audioCacheMaxMb"
    :cache-cleanup-message="cacheCleanupMessage"
    :cache-used-label="cacheUsedLabel"
    :clear-audio-cache="clearAudioCache"
    :locale="locale"
    :refresh-cache-status="refreshCacheStatus"
    :set-audio-cache-max-mb="setAudioCacheMaxMb"
  />
</template>
