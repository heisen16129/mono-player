<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import BaseDialog from './BaseDialog.vue';

const props = defineProps<{
  imagePath: string;
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [payload: { x: number; y: number; size: number }];
}>();

const CROP_SIZE = 300;
const VIEW_SIZE = 360;
const CROP_INSET = (VIEW_SIZE - CROP_SIZE) / 2;
const MAX_SCALE = 4;

const naturalWidth = ref(0);
const naturalHeight = ref(0);
const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const dragging = ref(false);
const dragStart = ref({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

const imageSrc = computed(() => props.imagePath ? convertFileSrc(props.imagePath) : '');
const imageName = computed(() => props.imagePath.split(/[\\/]/).pop() || props.imagePath);
const baseScale = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value) return 1;
  return Math.max(CROP_SIZE / naturalWidth.value, CROP_SIZE / naturalHeight.value);
});
const displayWidth = computed(() => naturalWidth.value * baseScale.value * scale.value);
const displayHeight = computed(() => naturalHeight.value * baseScale.value * scale.value);
const minOffsetX = computed(() => Math.min(0, CROP_SIZE - displayWidth.value));
const minOffsetY = computed(() => Math.min(0, CROP_SIZE - displayHeight.value));

const imageStyle = computed(() => ({
  width: `${displayWidth.value}px`,
  height: `${displayHeight.value}px`,
  transform: `translate3d(${CROP_INSET + offsetX.value}px, ${CROP_INSET + offsetY.value}px, 0)`,
}));
const stageStyle = computed(() => ({
  '--crop-inset': `${CROP_INSET}px`,
  '--crop-view-size': `${VIEW_SIZE}px`,
}));

watch(
  () => props.imagePath,
  () => {
    naturalWidth.value = 0;
    naturalHeight.value = 0;
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
  },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampOffset() {
  offsetX.value = clamp(offsetX.value, minOffsetX.value, 0);
  offsetY.value = clamp(offsetY.value, minOffsetY.value, 0);
}

function centerImage() {
  offsetX.value = (CROP_SIZE - displayWidth.value) / 2;
  offsetY.value = (CROP_SIZE - displayHeight.value) / 2;
  clampOffset();
}

function handleImageLoad(event: Event) {
  const image = event.target as HTMLImageElement;
  naturalWidth.value = image.naturalWidth;
  naturalHeight.value = image.naturalHeight;
  centerImage();
}

function updateScale(value: number) {
  const previousWidth = displayWidth.value || CROP_SIZE;
  const previousHeight = displayHeight.value || CROP_SIZE;
  const centerX = CROP_SIZE / 2 - offsetX.value;
  const centerY = CROP_SIZE / 2 - offsetY.value;
  scale.value = clamp(value, 1, MAX_SCALE);
  offsetX.value = CROP_SIZE / 2 - centerX * (displayWidth.value / previousWidth);
  offsetY.value = CROP_SIZE / 2 - centerY * (displayHeight.value / previousHeight);
  clampOffset();
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  updateScale(scale.value + (event.deltaY > 0 ? -0.08 : 0.08));
}

function startDrag(event: PointerEvent) {
  if (props.saving) return;
  dragging.value = true;
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function drag(event: PointerEvent) {
  if (!dragging.value) return;
  offsetX.value = dragStart.value.offsetX + event.clientX - dragStart.value.x;
  offsetY.value = dragStart.value.offsetY + event.clientY - dragStart.value.y;
  clampOffset();
}

function endDrag() {
  dragging.value = false;
}

function confirm() {
  if (!naturalWidth.value || !naturalHeight.value || props.saving) return;
  const ratio = naturalWidth.value / displayWidth.value;
  const size = Math.round(CROP_SIZE * ratio);
  emit('confirm', {
    x: Math.max(0, Math.round(-offsetX.value * ratio)),
    y: Math.max(0, Math.round(-offsetY.value * ratio)),
    size: Math.max(1, size),
  });
}

onBeforeUnmount(() => {
  dragging.value = false;
});
</script>

<template>
  <BaseDialog
    label="编辑封面"
    close-label="关闭"
    :close-disabled="saving"
    close-on-overlay
    width="min(440px, calc(100vw - 32px))"
    max-height="min(620px, calc(100vh - var(--player-height) - 48px))"
    grid-template-rows="auto minmax(0, 1fr)"
    overflow="hidden"
    panel-class="cover-crop-dialog"
    :z-index="380"
    @close="emit('close')"
  >
    <template #header>
      <div class="cover-crop-title">
        <h2>编辑封面</h2>
        <p>{{ imageName }}</p>
      </div>
    </template>

    <div class="cover-crop-body">
      <div class="cover-crop-editor">
        <div
          class="cover-crop-stage"
          :class="{ 'is-dragging': dragging }"
          :style="stageStyle"
          @pointerdown="startDrag"
          @pointermove="drag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @wheel="handleWheel"
        >
          <img :src="imageSrc" alt="" :style="imageStyle" draggable="false" @load="handleImageLoad" />
          <span class="crop-frame" aria-hidden="true"></span>
        </div>

      </div>

      <footer class="cover-crop-actions">
        <button class="secondary-button" type="button" :disabled="saving" @click="emit('close')">取消</button>
        <button class="confirm-button" type="button" :disabled="saving || !naturalWidth" @click="confirm">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </footer>
    </div>
  </BaseDialog>
</template>

<style scoped>
:global(.cover-crop-dialog) {
  background: var(--smw-bg-workspace);
}

.cover-crop-body {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
}

.cover-crop-title h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 650;
}

.cover-crop-title p {
  max-width: 340px;
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cover-crop-editor {
  display: grid;
  gap: 10px;
  min-height: 0;
  padding: 18px 18px 10px;
  overflow: hidden;
}

.cover-crop-stage {
  position: relative;
  width: var(--crop-view-size);
  height: var(--crop-view-size);
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: #111;
  cursor: grab;
  justify-self: center;
  touch-action: none;
}

.cover-crop-stage.is-dragging {
  cursor: grabbing;
}

.cover-crop-stage img {
  position: absolute;
  top: 0;
  left: 0;
  max-width: none;
  user-select: none;
  will-change: transform;
}

.crop-frame {
  position: absolute;
  inset: var(--crop-inset);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 0 0 var(--crop-inset) rgba(0, 0, 0, 0.46);
}

.cover-crop-actions {
  --button-min-height: 32px;
  --button-padding-x: 16px;
  --button-min-width: 70px;

  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px 16px;
}

</style>
