<script setup lang="ts">
import PlaybackAudioCacheDirectoryActions from './PlaybackAudioCacheDirectoryActions.vue';

defineProps<{
  audioCacheDir: string;
  chooseAudioCacheDir: () => void;
  locale: string;
  setAudioCacheDir: (cacheDir: string) => void;
  useDefaultCacheDir: () => void;
  useSystemTempCacheDir: () => void;
}>();
</script>

<template>
  <label class="field-row wide-field">
    <span>{{ locale === 'en-US' ? 'Temp cache' : '临时缓存目录' }}</span>
    <span class="path-field">
      <input
        type="text"
        :value="audioCacheDir"
        :placeholder="locale === 'en-US' ? 'App cache directory' : '应用缓存目录'"
        @change="setAudioCacheDir(($event.target as HTMLInputElement).value)"
      />
      <PlaybackAudioCacheDirectoryActions
        :choose-label="locale === 'en-US' ? 'Choose' : '选择'"
        :default-label="locale === 'en-US' ? 'Default' : '默认目录'"
        :system-temp-label="locale === 'en-US' ? 'System temp' : '系统临时目录'"
        @choose="chooseAudioCacheDir"
        @use-default="useDefaultCacheDir"
        @use-system-temp="useSystemTempCacheDir"
      />
    </span>
  </label>
</template>

<style scoped>
.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.wide-field {
  max-width: 560px;
}

.path-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  align-items: center;
}

.path-field input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.path-field input:hover {
  border-color: var(--smw-text-muted);
}

.path-field input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

</style>
