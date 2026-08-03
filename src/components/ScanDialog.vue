<script setup lang="ts">
import { t } from '../i18n';
import type { Locale } from '../types/music';
import BaseDialog from './BaseDialog.vue';
import ScanDialogEmptyState from './ScanDialogEmptyState.vue';
import ScanDialogFooter from './ScanDialogFooter.vue';
import ScanFolderRow from './ScanFolderRow.vue';

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
      <ScanFolderRow
        v-for="folder in folders"
        :key="folder.path"
        :confirming="confirming"
        :folder="folder"
        @remove="$emit('removeFolder', $event)"
        @update-checked="(path, checked) => $emit('updateFolderChecked', path, checked)"
      />
      <ScanDialogEmptyState v-if="folders.length === 0" :message="t(locale, 'scanEmpty')" />
    </div>

    <ScanDialogFooter
      :canceling="canceling"
      :confirming="confirming"
      :locale="locale"
      :progress-text="progressText"
      @cancel="$emit('cancel')"
      @confirm="$emit('confirm')"
    />
  </BaseDialog>
</template>

<style scoped>
.scan-dialog-toolbar {
  --button-min-height: 32px;
  --button-padding-x: 14px;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.scan-folder-list {
  display: grid;
  align-content: start;
  height: 238px;
  margin: 0 18px;
  overflow: auto;
  border: 1px solid var(--smw-border-soft);
  border-radius: 7px;
  background: var(--smw-bg-input);
}

</style>
