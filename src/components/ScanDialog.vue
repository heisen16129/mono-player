<script setup lang="ts">
import { Trash2 } from '@lucide/vue';
import { t } from '../i18n';
import type { Locale } from '../types/music';
import BaseDialog from './BaseDialog.vue';

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
  <BaseDialog :label="t(locale, 'scanDialogTitle')" :close-label="t(locale, 'close')" :close-disabled="confirming" :title="t(locale, 'scanDialogTitle')" @close="$emit('close')">

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
  </BaseDialog>
</template>

<style scoped>
.scan-dialog-toolbar {
  --button-min-height: 30px;
  --button-padding-x: 14px;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
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
  --button-min-height: 30px;
  --button-padding-x: 14px;

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

</style>
