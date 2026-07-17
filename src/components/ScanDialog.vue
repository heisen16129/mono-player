<script setup lang="ts">
import { Trash2, X } from '@lucide/vue';
import { t } from '../i18n';
import type { Locale } from '../types/music';

defineProps<{
  confirming: boolean;
  canceling: boolean;
  folders: { path: string; checked: boolean }[];
  locale: Locale;
  progressText?: string;
}>();

defineEmits<{
  close: [];
  addFolder: [];
  cancel: [];
  removeFolder: [path: string];
  confirm: [];
  updateFolderChecked: [path: string, checked: boolean];
}>();
</script>

<template>
  <div class="scan-dialog-overlay" role="presentation">
    <section class="scan-dialog" role="dialog" aria-modal="true" :aria-label="t(locale, 'scanDialogTitle')">
      <header class="scan-dialog-head">
        <h2>{{ t(locale, 'scanDialogTitle') }}</h2>
        <button class="icon-button" type="button" :aria-label="t(locale, 'close')" :disabled="confirming" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>

      <div class="scan-dialog-toolbar">
        <span>{{ t(locale, 'scanHint') }}</span>
        <button class="secondary-button" type="button" :disabled="confirming" @click="$emit('addFolder')">
          {{ t(locale, 'scanFolder') }}
        </button>
      </div>

      <div class="scan-folder-list">
        <label v-for="folder in folders" :key="folder.path" class="scan-folder-row">
          <input
            :checked="folder.checked"
            type="checkbox"
            :disabled="confirming"
            @change="$emit('updateFolderChecked', folder.path, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ folder.path }}</span>
          <button
            class="icon-button scan-delete-button"
            type="button"
            title="删除"
            :disabled="confirming"
            @click.prevent="$emit('removeFolder', folder.path)"
          >
            <Trash2 :size="17" />
          </button>
        </label>
        <p v-if="folders.length === 0" class="scan-empty">{{ t(locale, 'scanEmpty') }}</p>
      </div>

      <footer class="scan-dialog-actions">
        <p v-if="progressText" class="scan-progress">{{ progressText }}</p>
        <button v-if="confirming" class="secondary-button" type="button" :disabled="canceling" @click="$emit('cancel')">
          {{ canceling ? t(locale, 'canceling') : t(locale, 'cancel') }}
        </button>
        <button class="confirm-button" type="button" :disabled="confirming" @click="$emit('confirm')">
          {{ confirming ? t(locale, 'scanning') : t(locale, 'confirm') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.scan-dialog-overlay {
  position: fixed;
  inset: 0 0 var(--player-height) 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--smw-bg-canvas) 82%, transparent);
  backdrop-filter: blur(10px);
}

.scan-dialog {
  display: grid;
  width: min(490px, calc(100vw - 32px));
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-workspace);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
}

.scan-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.scan-dialog-head h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 560;
}

.scan-dialog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.secondary-button {
  display: inline-grid;
  min-height: 30px;
  place-items: center;
  padding: 0 14px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  cursor: pointer;
  white-space: nowrap;
}

.secondary-button:hover {
  background: var(--smw-bg-hover);
}

.scan-folder-list {
  display: grid;
  align-content: start;
  height: 238px;
  margin: 0 12px;
  overflow: auto;
  border: 1px solid var(--smw-border-soft);
  background: var(--smw-bg-input);
}

.scan-folder-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 0 8px;
  color: var(--smw-text-body);
  font-size: 12px;
}

.scan-folder-row:hover {
  background: color-mix(in srgb, var(--smw-bg-hover) 72%, transparent);
}

.scan-folder-row input {
  width: 14px;
  height: 14px;
  accent-color: var(--smw-text-primary);
}

.scan-folder-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-delete-button {
  color: var(--smw-text-secondary);
}

.scan-delete-button:hover {
  color: var(--smw-text-primary);
}

.scan-empty {
  margin: 0;
  padding: 28px 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-align: center;
}

.scan-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  padding: 16px 12px 12px;
}

.scan-progress {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.confirm-button {
  min-width: 52px;
  min-height: 30px;
  border: 1px solid var(--smw-button-primary);
  border-radius: 8px;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
  font-weight: 560;
}

.confirm-button:hover {
  filter: brightness(0.96);
}

.secondary-button:disabled,
.confirm-button:disabled {
  cursor: default;
  filter: none;
}

.confirm-button:disabled {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: #fff;
  background: color-mix(in srgb, var(--smw-button-primary) 62%, var(--smw-bg-input));
  opacity: 1;
}
</style>
