<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog';

const props = defineProps<{
  downloadDir: string;
  locale: string;
  setDownloadDir: (downloadDir: string) => void;
}>();

async function chooseDownloadDir() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: props.locale === 'en-US' ? 'Choose download directory' : '选择下载目录',
  });

  if (typeof selected === 'string') {
    props.setDownloadDir(selected);
  }
}
</script>

<template>
  <label class="field-row wide-field">
    <span>{{ locale === 'en-US' ? 'Download location' : '下载位置' }}</span>
    <span class="path-field">
      <input
        type="text"
        :value="downloadDir"
        :placeholder="locale === 'en-US' ? 'Choose music download directory' : '请选择音乐下载目录'"
        @change="setDownloadDir(($event.target as HTMLInputElement).value)"
      />
      <button class="secondary-button compact" type="button" @click="chooseDownloadDir">
        {{ locale === 'en-US' ? 'Choose' : '选择' }}
      </button>
    </span>
  </label>
</template>

<style scoped>
.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.wide-field {
  max-width: 560px;
}

.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
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

.secondary-button.compact:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, var(--smw-bg-input));
}

.secondary-button.compact:focus-visible {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
