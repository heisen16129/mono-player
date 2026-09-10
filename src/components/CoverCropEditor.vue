<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';

const props = withDefaults(defineProps<{
  cropSize?: number;
  imagePath: string;
  saving: boolean;
  viewHeight?: number;
  viewWidth?: number;
}>(), {
  cropSize: 360,
  viewHeight: 484,
  viewWidth: 760,
});

const MAX_SCALE = 4;
const naturalWidth = ref(0);
const naturalHeight = ref(0);
const imageElement = ref<HTMLImageElement | null>(null);
const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const dragging = ref(false);
const dragStart = ref({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

const imageSrc = computed(() => props.imagePath ? convertFileSrc(props.imagePath) : '');
const imageSizeLabel = computed(() => naturalWidth.value && naturalHeight.value ? `${naturalWidth.value} × ${naturalHeight.value}` : '');
const ready = computed(() => Boolean(naturalWidth.value && naturalHeight.value));
const cropInsetX = computed(() => (props.viewWidth - props.cropSize) / 2);
const cropInsetY = computed(() => (props.viewHeight - props.cropSize) / 2);
const baseScale = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value) return 1;
  return Math.max(props.cropSize / naturalWidth.value, props.cropSize / naturalHeight.value);
});
const displayWidth = computed(() => naturalWidth.value * baseScale.value * scale.value);
const displayHeight = computed(() => naturalHeight.value * baseScale.value * scale.value);
const minOffsetX = computed(() => Math.min(0, props.cropSize - displayWidth.value));
const minOffsetY = computed(() => Math.min(0, props.cropSize - displayHeight.value));
const imageStyle = computed(() => ({
  width: `${displayWidth.value}px`,
  height: `${displayHeight.value}px`,
  transform: `translate3d(${cropInsetX.value + offsetX.value}px, ${cropInsetY.value + offsetY.value}px, 0)`,
}));
const stageStyle = computed(() => ({
  '--crop-inset-x': `${cropInsetX.value}px`,
  '--crop-inset-y': `${cropInsetY.value}px`,
  '--crop-size': `${props.cropSize}px`,
  '--crop-view-width': `${props.viewWidth}px`,
  '--crop-view-height': `${props.viewHeight}px`,
}));

watch(() => props.imagePath, resetCrop);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampOffset() {
  offsetX.value = clamp(offsetX.value, minOffsetX.value, 0);
  offsetY.value = clamp(offsetY.value, minOffsetY.value, 0);
}

function centerImage() {
  offsetX.value = (props.cropSize - displayWidth.value) / 2;
  offsetY.value = (props.cropSize - displayHeight.value) / 2;
  clampOffset();
}

function resetCrop() {
  naturalWidth.value = 0;
  naturalHeight.value = 0;
  scale.value = 1;
  offsetX.value = 0;
  offsetY.value = 0;
}

function resetPosition() {
  scale.value = 1;
  centerImage();
}

function handleImageLoad(event: Event) {
  const image = event.target as HTMLImageElement;
  naturalWidth.value = image.naturalWidth;
  naturalHeight.value = image.naturalHeight;
  centerImage();
}

function updateScale(value: number) {
  const previousWidth = displayWidth.value || props.cropSize;
  const previousHeight = displayHeight.value || props.cropSize;
  const centerX = props.cropSize / 2 - offsetX.value;
  const centerY = props.cropSize / 2 - offsetY.value;
  scale.value = clamp(value, 1, MAX_SCALE);
  offsetX.value = props.cropSize / 2 - centerX * (displayWidth.value / previousWidth);
  offsetY.value = props.cropSize / 2 - centerY * (displayHeight.value / previousHeight);
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

function getCrop() {
  if (!ready.value) return null;
  const ratio = naturalWidth.value / displayWidth.value;
  return {
    x: Math.max(0, Math.round(-offsetX.value * ratio)),
    y: Math.max(0, Math.round(-offsetY.value * ratio)),
    size: Math.max(1, Math.round(props.cropSize * ratio)),
  };
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string | null>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.92);
  });
}

async function exportCropDataUrl() {
  const image = imageElement.value;
  const crop = getCrop();
  if (!image || !crop) return null;

  try {
    const outputSize = Math.min(crop.size, 1600);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      outputSize,
      outputSize,
    );
    return await canvasToDataUrl(canvas);
  } catch {
    return null;
  }
}

onBeforeUnmount(() => {
  dragging.value = false;
});

defineExpose({ exportCropDataUrl, getCrop, imageSizeLabel, ready, resetPosition });
</script>

<template>
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
    <img
      ref="imageElement"
      :src="imageSrc"
      alt=""
      :style="imageStyle"
      crossorigin="anonymous"
      draggable="false"
      @load="handleImageLoad"
    />
    <span class="crop-frame" aria-hidden="true">
      <span class="crop-grid"></span>
      <span class="crop-handle is-top-left"></span>
      <span class="crop-handle is-top-right"></span>
      <span class="crop-handle is-bottom-left"></span>
      <span class="crop-handle is-bottom-right"></span>
    </span>
  </div>
</template>

<style scoped>
.cover-crop-stage {
  position: relative;
  width: min(var(--crop-view-width), 100%);
  height: min(var(--crop-view-height), calc(100vh - var(--player-height) - 128px));
  overflow: hidden;
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

.crop-handle.is-top-left { top: -5px; left: -5px; }
.crop-handle.is-top-right { top: -5px; right: -5px; }
.crop-handle.is-bottom-left { bottom: -5px; left: -5px; }
.crop-handle.is-bottom-right { right: -5px; bottom: -5px; }
</style>
