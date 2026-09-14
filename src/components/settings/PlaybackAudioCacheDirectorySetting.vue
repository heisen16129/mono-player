<script setup lang="ts">

defineProps<{
  audioCacheDir: string;
  chooseAudioCacheDir: () => void;
  useDefaultCacheDir: () => void;
  useSystemTempCacheDir: () => void;
  locale: string;
  setAudioCacheDir: (cacheDir: string) => void;
}>();
</script>

<template>
  <div class="field-row wide-field">

    <span class="path-field">
      <input
        type="text"
        :aria-label="locale === 'en-US' ? 'Audio cache directory' : '音频缓存目录'"
        :value="audioCacheDir"
        :placeholder="locale === 'en-US' ? 'App cache directory' : '应用缓存目录'"
        @change="setAudioCacheDir(($event.target as HTMLInputElement).value)"
      />
    </span>
    <div class="directory-actions">
      <button class="secondary-button compact" type="button" @click="useSystemTempCacheDir">{{ locale === 'en-US' ? 'System temp' : '系统临时目录' }}</button>
      <button class="secondary-button compact" type="button" @click="useDefaultCacheDir">{{ locale === 'en-US' ? 'Default' : '默认目录' }}</button>
      <button class="secondary-button compact" type="button" @click="chooseAudioCacheDir">{{ locale === 'en-US' ? 'Choose' : '选择' }}</button>
    </div>
  </div>
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
  height: 28px;
  min-width: 0;
  padding: 0 6px;
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

.directory-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.directory-actions > button { flex: 1; font-size: 11px; }
</style>
