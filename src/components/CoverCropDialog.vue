<script setup lang="ts">
import { ImagePlus, Search } from '@lucide/vue';
import { ref, watch } from 'vue';
import CoverSearchDialog from './CoverSearchDialog.vue';
import BaseDialog from './BaseDialog.vue';
import CoverCropEditor from './CoverCropEditor.vue';

const props = withDefaults(defineProps<{
  searchQuery?: string;
  canChooseImage?: boolean;
  imagePath: string;
  saving: boolean;
}>(), {
  canChooseImage: false,
});

const emit = defineEmits<{
  chooseImage: [];
  close: [];
  confirm: [payload: { x: number; y: number; size: number; imageDataUrl?: string }];
}>();

const editor = ref<InstanceType<typeof CoverCropEditor> | null>(null);
const isExporting = ref(false);
const searchOpen = ref(false);
const searchedImage = ref('');
const exportError = ref('');
watch(() => props.imagePath, () => { searchedImage.value = ''; });

async function confirm() {
  const crop = editor.value?.getCrop();
  if (!crop || isExporting.value) return;
  isExporting.value = true;
  exportError.value = '';
  const imageDataUrl = await editor.value?.exportCropDataUrl();
  if (searchedImage.value && !imageDataUrl) {
    exportError.value = '封面导出失败，请重新选择图片后再试';
    isExporting.value = false;
    return;
  }
  emit('confirm', { ...crop, imageDataUrl: imageDataUrl ?? undefined });
  isExporting.value = false;
}
</script>

<template>
  <BaseDialog
    label="编辑封面"
    close-label="关闭"
    :close-disabled="saving"
    close-on-overlay
    width="min(868px, calc(100vw - 32px))"
    max-height="min(620px, calc(100vh - var(--player-height) - 32px))"
    grid-template-rows="auto minmax(0, 1fr)"
    header-padding="0 20px"
    overflow="hidden"
    panel-class="cover-crop-dialog"
    :z-index="380"
    @close="emit('close')"
  >
    <template #header>
      <h2 class="cover-crop-title">编辑封面</h2>
    </template>

    <div class="cover-crop-body">
      <div class="cover-crop-editor">
        <CoverCropEditor ref="editor" :image-path="searchedImage || imagePath" :saving="saving" />
      </div>

      <footer class="cover-crop-actions">
        <span v-if="exportError" role="alert">{{ exportError }}</span>
        <span class="cover-crop-size">{{ editor?.imageSizeLabel }}</span>
        <button v-if="canChooseImage" class="secondary-button choose-image-button" type="button" :disabled="saving || isExporting" @click="searchOpen = true"><Search :size="16" aria-hidden="true" />搜索封面</button>
        <button
          v-if="canChooseImage"
          class="secondary-button choose-image-button"
          type="button"
          :disabled="saving"
          @click="emit('chooseImage')"
        >
          <ImagePlus :size="16" aria-hidden="true" />
          选择图片
        </button>
        <button class="secondary-button" type="button" :disabled="saving || isExporting" @click="emit('close')">取消</button>
        <button class="confirm-button" type="button" :disabled="saving || isExporting || !editor?.ready" @click="confirm">
          {{ saving || isExporting ? '保存中...' : '保存' }}
        </button>
      </footer>
    </div>
  </BaseDialog>
  <CoverSearchDialog v-if="searchOpen" :initial-query="searchQuery || ''" @close="searchOpen = false" @select="searchedImage = $event; searchOpen = false" />
</template>

<style scoped>
:global(.cover-crop-dialog) {
  background: var(--smw-bg-workspace);
}

:global(.cover-crop-dialog .base-dialog-head) {
  min-height: 52px;
}

.cover-crop-body {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
}

.cover-crop-title {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 650;
}

.cover-crop-editor {
  display: grid;
  min-height: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--smw-bg-app) 88%, var(--smw-bg-workspace));
}

.cover-crop-actions {
  --button-min-height: 32px;
  --button-padding-x: 16px;
  --button-min-width: 70px;

  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 20px;
  border-top: 1px solid var(--smw-border-soft);
}

.cover-crop-size {
  margin-right: auto;
  color: var(--smw-text-tertiary);
  font-size: 12px;
}

.choose-image-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
</style>
