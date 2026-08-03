<script setup lang="ts">
import PlaybackAudioCacheClearAction from './PlaybackAudioCacheClearAction.vue';
import PlaybackAudioCacheSizeField from './PlaybackAudioCacheSizeField.vue';

const props = defineProps<{
  audioCacheMaxMb: number;
  cacheCleanupMessage: string;
  cacheUsedLabel: string;
  clearAudioCache: () => void;
  locale: string;
  refreshCacheStatus: () => Promise<void>;
  setAudioCacheMaxMb: (value: number) => void;
}>();

function setAudioCacheMaxMb(value: number) {
  props.setAudioCacheMaxMb(value);
  void props.refreshCacheStatus();
}
</script>

<template>
  <div class="setting-group">
    <p>{{ locale === 'en-US' ? 'Cache management' : '缓存管理' }}</p>
    <div class="cache-management-row">
      <PlaybackAudioCacheSizeField
        :label="locale === 'en-US' ? 'Max MB' : '最大 MB'"
        :value="audioCacheMaxMb"
        @change="setAudioCacheMaxMb"
      />
      <PlaybackAudioCacheClearAction
        :label="locale === 'en-US' ? 'Clear cache' : '清理缓存'"
        @clear="clearAudioCache"
      />
    </div>
    <small class="cache-cleanup-message">
      {{ locale === 'en-US' ? 'Used' : '已用' }} {{ cacheUsedLabel }} / {{ audioCacheMaxMb }} MB
      <template v-if="cacheCleanupMessage"> · {{ cacheCleanupMessage }}</template>
    </small>
  </div>
</template>

<style scoped>
.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.cache-management-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: end;
}

.cache-cleanup-message {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
