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

const CROP_SIZE = 360;
const VIEW_WIDTH = 760;
const VIEW_HEIGHT = 484;
const CROP_INSET_X = (VIEW_WIDTH - CROP_SIZE) / 2;
const CROP_INSET_Y = (VIEW_HEIGHT - CROP_SIZE) / 2;
const MAX_SCALE = 4;

const naturalWidth = ref(0);
const naturalHeight = ref(0);
const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const dragging = ref(false);
const dragStart = ref({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

const imageSrc = computed(() => props.imagePath ? convertFileSrc(props.imagePath) : '');
const imageSizeLabel = computed(() => naturalWidth.value && naturalHeight.value ? `${naturalWidth.value} × ${naturalHeight.value}` : '');
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
  transform: `translate3d(${CROP_INSET_X + offsetX.value}px, ${CROP_INSET_Y + offsetY.value}px, 0)`,
}));
const stageStyle = computed(() => ({
  '--crop-inset-x': `${CROP_INSET_X}px`,
  '--crop-inset-y': `${CROP_INSET_Y}px`,
  '--crop-size': `${CROP_SIZE}px`,
  '--crop-view-width': `${VIEW_WIDTH}px`,
  '--crop-view-height': `${VIEW_HEIGHT}px`,
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
      <div class="cover-crop-title">
        <h2>编辑封面</h2>
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
          <span class="crop-frame" aria-hidden="true">
            <span class="crop-grid"></span>
            <span class="crop-handle is-top-left"></span>
            <span class="crop-handle is-top-right"></span>
            <span class="crop-handle is-bottom-left"></span>
            <span class="crop-handle is-bottom-right"></span>
          </span>
        </div>
      </div>

      <footer class="cover-crop-actions">
        <span class="cover-crop-size">{{ imageSizeLabel }}</span>
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

:global(.cover-crop-dialog .base-dialog-head) {
  min-height: 52px;
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
  font-size: 14px;
  font-weight: 650;
}

.cover-crop-editor {
  display: grid;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--smw-bg-app) 88%, var(--smw-bg-workspace));
}

.cover-crop-stage {
  position: relative;
  width: min(var(--crop-view-width), 100%);
  height: min(var(--crop-view-height), calc(100vh - var(--player-height) - 128px));
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
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
  left: var(--crop-inset-x);
  top: var(--crop-inset-y);
  width: var(--crop-size);
  height: var(--crop-size);
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 0 0 max(var(--crop-inset-x), var(--crop-inset-y)) rgba(0, 0, 0, 0.42);
}

.crop-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, transparent calc(33.333% - 0.5px), rgba(255, 255, 255, 0.44) calc(33.333% - 0.5px), rgba(255, 255, 255, 0.44) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px)),
    linear-gradient(to right, transparent calc(66.666% - 0.5px), rgba(255, 255, 255, 0.44) calc(66.666% - 0.5px), rgba(255, 255, 255, 0.44) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)),
    linear-gradient(to bottom, transparent calc(33.333% - 0.5px), rgba(255, 255, 255, 0.44) calc(33.333% - 0.5px), rgba(255, 255, 255, 0.44) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px)),
    linear-gradient(to bottom, transparent calc(66.666% - 0.5px), rgba(255, 255, 255, 0.44) calc(66.666% - 0.5px), rgba(255, 255, 255, 0.44) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px));
}

.crop-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1px solid color-mix(in srgb, var(--smw-text-secondary) 45%, white);
  background: white;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
}

.crop-handle.is-top-left {
  top: -5px;
  left: -5px;
}

.crop-handle.is-top-right {
  top: -5px;
  right: -5px;
}

.crop-handle.is-bottom-left {
  bottom: -5px;
  left: -5px;
}

.crop-handle.is-bottom-right {
  right: -5px;
  bottom: -5px;
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

</style>
