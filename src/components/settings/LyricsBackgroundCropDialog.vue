<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

const props = defineProps<{
  color: string;
  isVideo: boolean;
  locale: string;
  mediaUrl: string;
  positionX: number;
  positionY: number;
  scale: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [value: { positionX: number; positionY: number; scale: number }];
}>();

const isEnglish = computed(() => props.locale === 'en-US');
const isDragging = ref(false);
const draft = reactive({
  positionX: props.positionX,
  positionY: props.positionY,
  scale: props.scale,
});
let dragState: { pointerId: number; x: number; y: number } | null = null;

const mediaStyle = computed(() => ({
  objectPosition: `${draft.positionX}% ${draft.positionY}%`,
  transform: `scale(${draft.scale * 1.002})`,
  transformOrigin: `${draft.positionX}% ${draft.positionY}%`,
}));

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function updateScale(event: Event) {
  draft.scale = clamp(Number((event.target as HTMLInputElement).value), 1, 2.8);
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  isDragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveDrag(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  event.preventDefault();
  const stage = event.currentTarget as HTMLElement;
  const rect = stage.getBoundingClientRect();
  const deltaX = event.clientX - dragState.x;
  const deltaY = event.clientY - dragState.y;
  dragState.x = event.clientX;
  dragState.y = event.clientY;
  draft.positionX = clamp(draft.positionX - (deltaX / Math.max(1, rect.width)) * 100 / draft.scale, 0, 100);
  draft.positionY = clamp(draft.positionY - (deltaY / Math.max(1, rect.height)) * 100 / draft.scale, 0, 100);
}

function stopDrag(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const stage = event.currentTarget as HTMLElement;
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  dragState = null;
  isDragging.value = false;
}

function adjustScale(event: WheelEvent) {
  event.preventDefault();
  draft.scale = clamp(draft.scale + (event.deltaY < 0 ? 0.08 : -0.08), 1, 2.8);
}

function resetCrop() {
  draft.positionX = 50;
  draft.positionY = 50;
  draft.scale = 1;
}
</script>

<template>
  <Teleport to="body">
    <div class="background-crop-mask" role="presentation" @click.self="emit('close')">
      <section class="background-crop-modal" role="dialog" aria-modal="true" :aria-label="isEnglish ? 'Crop background media' : '裁切背景媒体'">
        <h2>{{ isEnglish ? 'Crop background media' : '裁切背景媒体' }}</h2>

        <div class="background-crop-layout">
          <div
            class="background-crop-stage"
            :class="{ dragging: isDragging }"
            :style="{ backgroundColor: color }"
            @pointerdown="startDrag"
            @pointermove="moveDrag"
            @pointerup="stopDrag"
            @pointercancel="stopDrag"
            @wheel="adjustScale"
          >
            <video
              v-if="isVideo && mediaUrl"
              :src="mediaUrl"
              :style="mediaStyle"
              autoplay
              loop
              muted
              playsinline
            />
            <img v-else-if="mediaUrl" :src="mediaUrl" :style="mediaStyle" alt="" />
            <span v-else>{{ isEnglish ? 'No preview available' : '暂无可预览的背景' }}</span>
          </div>

          <div class="background-crop-side">
            <div class="background-crop-preview" :style="{ backgroundColor: color }" aria-hidden="true">
              <video
                v-if="isVideo && mediaUrl"
                :src="mediaUrl"
                :style="mediaStyle"
                autoplay
                loop
                muted
                playsinline
              />
              <img v-else-if="mediaUrl" :src="mediaUrl" :style="mediaStyle" alt="" />
            </div>

            <label class="background-crop-zoom">
              <span>{{ isEnglish ? 'Scale' : '缩放' }}</span>
              <input type="range" min="1" max="2.8" step="0.01" :value="draft.scale" @input="updateScale" />
            </label>
            <div class="background-crop-note">
              {{ isEnglish ? 'Drag the preview to reposition' : '拖动预览调整位置' }}
            </div>
          </div>
        </div>

        <footer class="background-crop-actions">
          <button type="button" @click="emit('close')">{{ isEnglish ? 'Cancel' : '取消' }}</button>
          <button type="button" @click="resetCrop">{{ isEnglish ? 'Reset' : '复位' }}</button>
          <button class="primary" type="button" @click="emit('confirm', { ...draft })">
            {{ isEnglish ? 'Use crop' : '使用裁切' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.background-crop-mask {
  position: fixed;
  inset: 0 0 var(--player-height) 0;
  z-index: 160;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(5px);
}

.background-crop-modal {
  isolation: isolate;
  width: min(820px, calc(100vw - 48px));
  max-height: calc(100vh - var(--player-height) - 48px);
  box-sizing: border-box;
  padding: 28px;
  overflow: auto;
  border: 1px solid var(--smw-border);
  border-radius: 18px;
  color: var(--smw-text-body);
  background: var(--smw-bg-workspace);
  box-shadow: 0 24px 72px rgba(15, 23, 42, 0.24);
}

.background-crop-modal h2 {
  margin: 0 0 22px;
  color: var(--smw-text-primary);
  font-size: 20px;
  font-weight: 720;
  text-align: center;
}

.background-crop-layout {
  display: grid;
  grid-template-columns: minmax(360px, 520px) 1fr;
  gap: 24px;
  align-items: center;
}

.background-crop-stage {
  position: relative;
  width: min(520px, 58vw);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 16px;
  background: color-mix(in srgb, var(--smw-bg-canvas) 72%, #000000);
  box-shadow: 0 14px 42px rgba(15, 23, 42, 0.18), inset 0 0 0 1px var(--smw-border);
  cursor: grab;
  touch-action: none;
}

.background-crop-stage.dragging {
  cursor: grabbing;
}

.background-crop-stage img,
.background-crop-stage video,
.background-crop-preview img,
.background-crop-preview video {
  position: absolute;
  inset: -1px;
  width: calc(100% + 2px);
  height: calc(100% + 2px);
  object-fit: cover;
  user-select: none;
  pointer-events: none;
  will-change: transform, object-position;
}

.background-crop-stage > span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.background-crop-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.15)) 33.333% 0 / 1px 100% no-repeat,
    linear-gradient(rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.15)) 66.666% 0 / 1px 100% no-repeat,
    linear-gradient(90deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.15)) 0 33.333% / 100% 1px no-repeat,
    linear-gradient(90deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.15)) 0 66.666% / 100% 1px no-repeat;
}

.background-crop-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 16px;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--smw-button-primary) 48%, transparent),
    inset 0 0 42px color-mix(in srgb, var(--smw-button-primary) 8%, transparent);
}

.background-crop-side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.background-crop-preview {
  position: relative;
  width: 160px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 12px;
  background: var(--smw-bg-input);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14), 0 0 0 1px var(--smw-border);
}

.background-crop-zoom {
  display: flex;
  width: min(240px, 100%);
  align-items: center;
  gap: 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.background-crop-zoom input {
  flex: 1;
  min-width: 0;
  accent-color: var(--smw-button-primary);
  cursor: pointer;
}

.background-crop-note {
  color: var(--smw-text-muted);
  font-size: 11px;
  text-align: center;
}

.background-crop-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 24px;
}

.background-crop-actions button {
  min-height: 36px;
  padding: 0 18px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.background-crop-actions button:hover {
  background: var(--smw-bg-hover);
}

.background-crop-actions button.primary {
  border-color: var(--smw-button-primary);
  color: var(--smw-button-primary-text, #ffffff);
  background: var(--smw-button-primary);
}

.background-crop-actions button.primary:hover {
  filter: brightness(0.96);
}

@media (max-width: 680px) {
  .background-crop-mask {
    padding: 16px;
  }

  .background-crop-modal {
    width: min(100%, 560px);
    max-height: calc(100vh - var(--player-height) - 32px);
    padding: 24px;
  }

  .background-crop-layout {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 18px;
  }

  .background-crop-stage {
    width: min(520px, 78vw);
  }

  .background-crop-side {
    width: 100%;
  }
}
</style>
