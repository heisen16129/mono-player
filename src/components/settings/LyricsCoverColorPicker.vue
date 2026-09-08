<script setup lang="ts">
import { Pipette, X } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { artworkColorPalette, artworkUrlDataUrl } from '../../utils/artwork';

const props = defineProps<{
  coverUrl: string;
  locale: string;
  selectedColor: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [color: string];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const dialog = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const loadError = ref('');
const palette = ref<string[]>([]);
const draftColor = ref(props.selectedColor || '#000000');
const marker = ref<{ x: number; y: number } | null>(null);
const isEnglish = computed(() => props.locale === 'en-US');
let loadId = 0;

function channelHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function rgbHex(red: number, green: number, blue: number) {
  return `#${channelHex(red)}${channelHex(green)}${channelHex(blue)}`;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('cover-load-failed')), { once: true });
    image.src = source;
  });
}

function drawCover(image: HTMLImageElement) {
  const target = canvas.value;
  if (!target) return;
  const context = target.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const size = 512;
  target.width = size;
  target.height = size;
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.clearRect(0, 0, size, size);
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
}

async function loadCover() {
  const currentLoadId = ++loadId;
  isLoading.value = true;
  loadError.value = '';
  palette.value = [];
  marker.value = null;
  try {
    await nextTick();
    const source = await artworkUrlDataUrl(props.coverUrl).catch(() => props.coverUrl);
    const [image, colors] = await Promise.all([
      loadImage(source),
      artworkColorPalette(props.coverUrl, 4),
    ]);
    if (currentLoadId !== loadId) return;
    drawCover(image);
    palette.value = colors;
  } catch {
    if (currentLoadId === loadId) {
      loadError.value = isEnglish.value ? 'Artwork could not be sampled' : '无法读取此封面的颜色';
    }
  } finally {
    if (currentLoadId === loadId) isLoading.value = false;
  }
}

function sampleColor(event: PointerEvent) {
  const target = canvas.value;
  if (!target || isLoading.value || loadError.value) return;
  const rect = target.getBoundingClientRect();
  const x = Math.min(target.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * target.width)));
  const y = Math.min(target.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * target.height)));
  try {
    const pixel = target.getContext('2d', { willReadFrequently: true })?.getImageData(x, y, 1, 1).data;
    if (!pixel || pixel[3] < 16) return;
    draftColor.value = rgbHex(pixel[0], pixel[1], pixel[2]);
    marker.value = {
      x: (x / target.width) * 100,
      y: (y / target.height) * 100,
    };
  } catch {
    loadError.value = isEnglish.value ? 'This artwork cannot be sampled' : '此封面暂时无法取色';
  }
}

function chooseRecommendedColor(color: string) {
  draftColor.value = color;
  marker.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

watch(() => props.coverUrl, loadCover, { immediate: true });
watch(() => props.selectedColor, (color) => {
  if (/^#[0-9a-f]{6}$/i.test(color)) draftColor.value = color;
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  void nextTick(() => dialog.value?.focus());
});
onBeforeUnmount(() => {
  loadId += 1;
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div class="cover-color-mask" role="presentation" @click.self="emit('close')">
      <section
        ref="dialog"
        class="cover-color-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-label="isEnglish ? 'Pick a color from artwork' : '从封面取色'"
      >
        <header class="cover-color-header">
          <span>
            <strong>{{ isEnglish ? 'Artwork color' : '封面取色' }}</strong>
            <small>{{ isEnglish ? 'Choose any color directly from the artwork' : '点击封面任意位置选择颜色' }}</small>
          </span>
          <button type="button" :aria-label="isEnglish ? 'Close' : '关闭'" @click="emit('close')">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>

        <div class="cover-color-content">
          <div class="cover-canvas-wrap" :class="{ loading: isLoading, failed: loadError }">
            <canvas
              ref="canvas"
              :aria-label="isEnglish ? 'Artwork color sampling area' : '封面取色区域'"
              @pointerdown="sampleColor"
            />
            <span
              v-if="marker"
              class="sample-marker"
              :style="{ left: `${marker.x}%`, top: `${marker.y}%`, backgroundColor: draftColor }"
              aria-hidden="true"
            />
            <span v-if="isLoading" class="canvas-status">{{ isEnglish ? 'Loading artwork...' : '正在读取封面...' }}</span>
            <span v-else-if="loadError" class="canvas-status">{{ loadError }}</span>
          </div>

          <div class="cover-color-side">
            <div class="selected-color">
              <span class="selected-swatch" :style="{ backgroundColor: draftColor }" />
              <span>
                <small>{{ isEnglish ? 'Selected color' : '当前选择' }}</small>
                <strong>{{ draftColor.toUpperCase() }}</strong>
              </span>
            </div>

            <div class="recommended-colors">
              <small>{{ isEnglish ? 'Suggested from artwork' : '封面推荐色' }}</small>
              <div class="recommended-swatches">
                <button
                  v-for="color in palette"
                  :key="color"
                  type="button"
                  :class="{ active: color.toLowerCase() === draftColor.toLowerCase() }"
                  :style="{ backgroundColor: color }"
                  :aria-label="color.toUpperCase()"
                  :title="color.toUpperCase()"
                  @click="chooseRecommendedColor(color)"
                />
              </div>
            </div>

            <p><Pipette :size="15" aria-hidden="true" />{{ isEnglish ? 'Click anywhere on the artwork to sample that pixel.' : '点击封面即可读取该位置的颜色。' }}</p>
          </div>
        </div>

        <footer class="cover-color-actions">
          <button type="button" @click="emit('close')">{{ isEnglish ? 'Cancel' : '取消' }}</button>
          <button type="button" @click="emit('confirm', '')">{{ isEnglish ? 'Automatic' : '自动主色' }}</button>
          <button class="primary" type="button" :disabled="Boolean(loadError)" @click="emit('confirm', draftColor)">
            {{ isEnglish ? 'Use color' : '使用此颜色' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.cover-color-mask {
  position: fixed;
  inset: 0 0 var(--player-height) 0;
  z-index: 165;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(5px);
}

.cover-color-dialog {
  width: min(620px, calc(100vw - 48px));
  max-height: calc(100vh - var(--player-height) - 48px);
  overflow: auto;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-workspace);
  box-shadow: 0 24px 72px rgba(15, 23, 42, 0.24);
  outline: none;
}

.cover-color-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--smw-border);
}

.cover-color-header > span {
  display: grid;
  gap: 3px;
}

.cover-color-header strong {
  color: var(--smw-text-primary);
  font-size: 16px;
}

.cover-color-header small,
.recommended-colors > small {
  color: var(--smw-text-secondary);
  font-size: 11px;
}

.cover-color-header button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 50%;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-input);
  cursor: pointer;
}

.cover-color-header button:hover {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.cover-color-content {
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(180px, 1fr);
  gap: 22px;
  align-items: center;
  padding: 22px 20px;
}

.cover-canvas-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-input);
  cursor: crosshair;
}

.cover-canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.cover-canvas-wrap.loading,
.cover-canvas-wrap.failed {
  cursor: default;
}

.canvas-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font-size: 12px;
  text-align: center;
}

.sample-marker {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 3px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.cover-color-side {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.selected-color {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-color > span:last-child {
  display: grid;
  gap: 3px;
}

.selected-color small {
  color: var(--smw-text-secondary);
  font-size: 11px;
}

.selected-color strong {
  color: var(--smw-text-primary);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.selected-swatch {
  width: 52px;
  height: 42px;
  flex: none;
  border: 1px solid color-mix(in srgb, var(--smw-border-strong) 72%, transparent);
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.recommended-colors {
  display: grid;
  gap: 9px;
}

.recommended-swatches {
  display: grid;
  grid-template-columns: repeat(4, 38px);
  gap: 8px;
  min-height: 38px;
}

.recommended-swatches button {
  width: 38px;
  height: 38px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--smw-border);
  cursor: pointer;
}

.recommended-swatches button.active {
  border-color: var(--smw-bg-workspace);
  box-shadow: 0 0 0 2px var(--smw-button-primary);
}

.cover-color-side p {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.cover-color-side p svg {
  flex: none;
  margin-top: 2px;
}

.cover-color-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--smw-border);
}

.cover-color-actions button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.cover-color-actions button:hover:not(:disabled) {
  background: var(--smw-bg-hover);
}

.cover-color-actions button.primary {
  border-color: var(--smw-button-primary);
  color: var(--smw-button-primary-text, #ffffff);
  background: var(--smw-button-primary);
}

.cover-color-actions button:disabled {
  cursor: default;
  opacity: 0.45;
}

.cover-color-header button:focus-visible,
.recommended-swatches button:focus-visible,
.cover-color-actions button:focus-visible {
  outline: 2px solid var(--smw-button-primary);
  outline-offset: 2px;
}

@media (max-width: 620px) {
  .cover-color-mask {
    padding: 16px;
  }

  .cover-color-dialog {
    width: min(100%, 460px);
    max-height: calc(100vh - var(--player-height) - 32px);
  }

  .cover-color-content {
    grid-template-columns: 1fr;
  }

  .cover-canvas-wrap {
    width: min(100%, 300px);
    justify-self: center;
  }
}
</style>
