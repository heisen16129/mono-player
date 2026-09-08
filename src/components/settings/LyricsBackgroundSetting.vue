<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog';
import { ChevronDown, RotateCcw } from '@lucide/vue';
import { computed, onBeforeUnmount, ref } from 'vue';
import { DEFAULT_LYRICS_BACKGROUND } from '../../stores/player/constants';
import type { WallpaperEngineProject } from '../../services/wallpaperEngine';
import type { LyricsBackgroundMediaKind, LyricsBackgroundSettings } from '../../types/music';
import { artworkDisplaySrc, filePathToArtworkUrl } from '../../utils/artwork';
import LyricsBackgroundCropDialog from './LyricsBackgroundCropDialog.vue';
import LyricsCoverColorPicker from './LyricsCoverColorPicker.vue';
import WallpaperEnginePicker from './WallpaperEnginePicker.vue';
import { wallpaperEngineRuntime, retryWallpaperEngineBackground } from '../../composables/useWallpaperEngineBackground';
import { useArtworkDominantColor } from '../../composables/useArtworkDominantColor';

const props = defineProps<{
  coverUrl: string;
  locale: string;
  preview: (patch: Partial<LyricsBackgroundSettings>) => void;
  value: LyricsBackgroundSettings;
  update: (patch: Partial<LyricsBackgroundSettings>) => void;
}>();

const isOpen = ref(true);
const isCropDialogOpen = ref(false);
const isCoverColorPickerOpen = ref(false);
const isWallpaperPickerOpen = ref(false);
const isEnglish = computed(() => props.locale === 'en-US');
const coverDominantColor = useArtworkDominantColor(
  () => props.coverUrl,
  () => props.value.colorMode === 'cover' && !props.value.coverColor,
);
const displayedColor = computed(() => (
  props.value.colorMode === 'cover'
    ? (props.value.coverColor || coverDominantColor.value || props.value.color)
    : props.value.color
));
const mediaName = computed(() => props.value.mediaPath.split(/[\\/]/).pop() || '');
const mediaPreviewUrl = computed(() => {
  if (props.value.source === 'cover') return props.coverUrl;
  return props.value.mediaPath
    ? artworkDisplaySrc(filePathToArtworkUrl(props.value.mediaPath))
    : props.coverUrl;
});
const previewIsVideo = computed(() => (
  props.value.source === 'media'
  && Boolean(props.value.mediaPath)
  && props.value.mediaKind === 'video'
));
const sourceDescription = computed(() => {
  if (props.value.source === 'cover') return isEnglish.value ? 'Album artwork' : '专辑封面';
  if (props.value.source === 'color') return isEnglish.value ? 'Solid color' : '纯色背景';
  return mediaName.value || (isEnglish.value ? 'Custom media' : '自定义媒体');
});
const wallpaperPreviewUrl = computed(() => {
  const path = props.value.wallpaperPreviewPath || props.value.wallpaperMediaPath;
  return path ? artworkDisplaySrc(filePathToArtworkUrl(path)) : '';
});
const wallpaperDescription = computed(() => (
  props.value.wallpaperTitle || (isEnglish.value ? 'Choose from your local library' : '从本机壁纸库中选择')
));
const isNativeScene = computed(() => props.value.source === 'wallpaper' && props.value.wallpaperProjectType === 'scene');
const sceneControlHint = computed(() => isNativeScene.value
  ? (isEnglish.value ? 'Native scenes are rendered by Wallpaper Engine' : '原生场景由 Wallpaper Engine 渲染') : undefined);
const wallpaperButtonLabel = computed(() => {
  if (props.value.source !== 'wallpaper') return isEnglish.value ? 'Use' : '使用';
  if (props.value.wallpaperProjectType !== 'scene') return isEnglish.value ? 'Active' : '使用中';
  const phase = wallpaperEngineRuntime.value.projectId === props.value.wallpaperProjectId
    ? wallpaperEngineRuntime.value.phase : 'idle';
  if (phase === 'active') return isEnglish.value ? 'Active' : '使用中';
  if (phase === 'loading') return isEnglish.value ? 'Loading' : '加载中';
  if (phase === 'error') return isEnglish.value ? 'Retry' : '重试';
  return isEnglish.value ? 'Selected' : '已选择';
});
function useWallpaper() {
  if (props.value.source === 'wallpaper' && wallpaperEngineRuntime.value.phase === 'error') retryWallpaperEngineBackground();
  else props.update({ source: 'wallpaper' });
}
let previewFrame = 0;
let pendingPreview: Partial<LyricsBackgroundSettings> | null = null;

function flushPreview() {
  if (previewFrame) cancelAnimationFrame(previewFrame);
  previewFrame = 0;
  if (!pendingPreview) return;
  props.preview(pendingPreview);
  pendingPreview = null;
}

function schedulePreview(patch: Partial<LyricsBackgroundSettings>) {
  pendingPreview = { ...pendingPreview, ...patch };
  if (previewFrame) return;
  previewFrame = requestAnimationFrame(flushPreview);
}

onBeforeUnmount(() => {
  if (previewFrame) cancelAnimationFrame(previewFrame);
});

const sliderRows = computed(() => [
  {
    key: 'windowOpacity' as const,
    label: isEnglish.value ? 'Window opacity' : '窗口透明度',
    min: 0,
    max: 1,
    step: 0.01,
    value: props.value.windowOpacity,
    output: props.value.windowOpacity.toFixed(2),
  },
  {
    key: 'opacity' as const,
    label: isEnglish.value ? 'Background opacity' : '背景透明度',
    min: 0,
    max: 1,
    step: 0.01,
    value: props.value.opacity,
    output: props.value.opacity.toFixed(2),
  },
  {
    key: 'blur' as const,
    label: isEnglish.value ? 'Background blur' : '背景模糊',
    min: 0,
    max: 60,
    step: 1,
    value: props.value.blur,
    output: String(Math.round(props.value.blur)),
  },
  {
    key: 'positionX' as const,
    label: isEnglish.value ? 'Crop left / right' : '裁切左右',
    min: 0,
    max: 100,
    step: 1,
    value: props.value.positionX,
    output: String(Math.round(props.value.positionX)),
  },
  {
    key: 'positionY' as const,
    label: isEnglish.value ? 'Crop top / bottom' : '裁切上下',
    min: 0,
    max: 100,
    step: 1,
    value: props.value.positionY,
    output: String(Math.round(props.value.positionY)),
  },
  {
    key: 'scale' as const,
    label: isEnglish.value ? 'Crop scale' : '裁切缩放',
    min: 1,
    max: 2.8,
    step: 0.01,
    value: props.value.scale,
    output: props.value.scale.toFixed(2),
  },
]);

function mediaKind(path: string): LyricsBackgroundMediaKind {
  return /\.(?:mp4|webm|mov|m4v)$/i.test(path) ? 'video' : 'image';
}

async function chooseMedia() {
  const selected = await open({
    multiple: false,
    title: isEnglish.value ? 'Choose lyrics background' : '选择歌词背景',
    filters: [{
      name: isEnglish.value ? 'Images and videos' : '图片和视频',
      extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'mp4', 'webm', 'mov', 'm4v'],
    }],
  });
  if (typeof selected !== 'string') return;
  props.update({ source: 'media', mediaPath: selected, mediaKind: mediaKind(selected) });
}

function clearMedia() {
  props.update({ mediaPath: '', mediaKind: 'image', source: 'cover' });
}

function selectWallpaper(project: WallpaperEngineProject, manualRoot: string) {
  props.update({
    source: 'wallpaper',
    wallpaperRoot: manualRoot,
    wallpaperProjectId: project.id,
    wallpaperTitle: project.title,
    wallpaperProjectType: project.projectType,
    wallpaperMediaPath: project.mediaPath,
    wallpaperPreviewPath: project.previewPath,
  });
  isWallpaperPickerOpen.value = false;
}

function applyCrop(value: Pick<LyricsBackgroundSettings, 'positionX' | 'positionY' | 'scale'>) {
  props.update(value);
  isCropDialogOpen.value = false;
}

function updateSlider(key: 'windowOpacity' | 'opacity' | 'blur' | 'positionX' | 'positionY' | 'scale', event: Event) {
  schedulePreview({ [key]: Number((event.target as HTMLInputElement).value) });
}

function commitSlider(key: 'windowOpacity' | 'opacity' | 'blur' | 'positionX' | 'positionY' | 'scale', event: Event) {
  flushPreview();
  props.update({ [key]: Number((event.target as HTMLInputElement).value) });
}

function previewColor(event: Event) {
  schedulePreview({
    color: (event.target as HTMLInputElement).value,
    colorMode: 'custom',
  });
}

function commitColor(event: Event) {
  flushPreview();
  props.update({
    color: (event.target as HTMLInputElement).value,
    colorMode: 'custom',
  });
}

function useCustomColor() {
  props.update({ source: 'color', colorMode: 'custom' });
}

function useCoverColor() {
  if (!props.coverUrl) return;
  isCoverColorPickerOpen.value = true;
}

function applyCoverColor(color: string) {
  props.update({
    source: 'color',
    colorMode: 'cover',
    coverColor: color,
  });
  isCoverColorPickerOpen.value = false;
}

function resetSlider(key: 'windowOpacity' | 'opacity' | 'blur' | 'positionX' | 'positionY' | 'scale') {
  props.update({ [key]: DEFAULT_LYRICS_BACKGROUND[key] });
}
</script>

<template>
  <section class="background-panel" :class="{ collapsed: !isOpen }">
    <button class="panel-disclosure" type="button" :aria-expanded="isOpen" @click="isOpen = !isOpen">
      <span class="panel-heading">
        <strong>{{ isEnglish ? 'Background media' : '背景媒体' }}</strong>
        <small>{{ isEnglish ? 'Color, artwork, images and videos' : '颜色、封面、图片与视频' }}</small>
      </span>
      <ChevronDown :size="18" aria-hidden="true" />
    </button>

    <div v-show="isOpen" class="panel-content">
      <div class="source-group">
        <div class="source-row">
          <label
            class="color-swatch"
            :style="{ backgroundColor: displayedColor }"
            :title="isEnglish ? 'Background color' : '背景颜色'"
          >
            <input
              type="color"
              :value="value.color"
              @input="previewColor"
              @change="commitColor"
            />
          </label>
          <span class="source-copy">
            <strong>{{ isEnglish ? 'Background color' : '背景颜色' }}</strong>
            <small>{{ displayedColor.toUpperCase() }}</small>
          </span>
          <span class="color-actions">
            <button class="source-action" :class="{ active: value.source === 'color' && value.colorMode === 'custom' }" type="button" @click="useCustomColor">
              {{ isEnglish ? 'Custom' : '自选色' }}
            </button>
            <button
              class="source-action"
              :class="{ active: value.source === 'color' && value.colorMode === 'cover' }"
              type="button"
              :disabled="!coverUrl"
              :title="!coverUrl ? (isEnglish ? 'No artwork available' : '当前歌曲没有封面') : undefined"
              @click="useCoverColor"
            >
              {{ isEnglish ? 'Artwork color' : '封面色' }}
            </button>
          </span>
        </div>

        <div class="source-row media-row">
          <span class="media-preview" aria-hidden="true">
            <video v-if="previewIsVideo && mediaPreviewUrl" :src="mediaPreviewUrl" muted playsinline />
            <img v-else-if="mediaPreviewUrl" :src="mediaPreviewUrl" alt="" />
            <span v-else>{{ value.source === 'cover' ? 'ART' : 'IMG' }}</span>
          </span>
          <span class="source-copy">
            <strong>{{ isEnglish ? 'Background media' : '背景媒体' }}</strong>
            <small :title="value.mediaPath">{{ sourceDescription }}</small>
          </span>
          <span class="media-actions">
            <button class="source-action" :class="{ active: value.source === 'cover' }" type="button" @click="update({ source: 'cover' })">
              {{ isEnglish ? 'Artwork' : '封面' }}
            </button>
            <button class="source-action" type="button" @click="chooseMedia">{{ isEnglish ? 'Choose' : '选择' }}</button>
            <button class="source-action" type="button" :disabled="isNativeScene" :title="sceneControlHint" @click="isCropDialogOpen = true">{{ isEnglish ? 'Crop' : '裁切' }}</button>
            <button class="source-action" type="button" :disabled="!value.mediaPath" @click="clearMedia">{{ isEnglish ? 'Clear' : '清除' }}</button>
          </span>
        </div>

        <div class="source-row wallpaper-row">
          <span class="wallpaper-mark" aria-hidden="true">
            <img v-if="wallpaperPreviewUrl" :src="wallpaperPreviewUrl" alt="" />
            <span v-else>WE</span>
          </span>
          <span class="source-copy">
            <strong>Wallpaper Engine</strong>
            <small :title="value.wallpaperTitle">{{ wallpaperDescription }}</small>
          </span>
          <span class="media-actions">
            <button
              v-if="value.wallpaperProjectId"
              class="source-action"
              :class="{ active: value.source === 'wallpaper' }"
              type="button"
              @click="useWallpaper"
            >
              {{ wallpaperButtonLabel }}
            </button>
            <button class="source-action" type="button" @click="isWallpaperPickerOpen = true">{{ isEnglish ? 'Library' : '壁纸库' }}</button>
          </span>
        </div>
      </div>

      <div class="crop-controls">
        <label v-for="row in sliderRows" :key="row.key" class="slider-row" :title="sceneControlHint">
          <span>{{ row.label }}</span>
          <input
            type="range"
            :min="row.min"
            :max="row.max"
            :step="row.step"
            :value="row.value"
            :disabled="isNativeScene"
            @input="updateSlider(row.key, $event)"
            @change="commitSlider(row.key, $event)"
          />
          <output>{{ row.output }}</output>
          <button
            class="reset-button"
            type="button"
            :disabled="isNativeScene"
            :aria-label="`${isEnglish ? 'Reset' : '重置'}${row.label}`"
            :title="isEnglish ? 'Reset' : '重置'"
            @click.prevent="resetSlider(row.key)"
          >
            <RotateCcw :size="14" aria-hidden="true" />
          </button>
        </label>
      </div>
    </div>
  </section>
  <LyricsBackgroundCropDialog
    v-if="isCropDialogOpen"
    :color="value.color"
    :is-video="previewIsVideo"
    :locale="locale"
    :media-url="mediaPreviewUrl"
    :position-x="value.positionX"
    :position-y="value.positionY"
    :scale="value.scale"
    @close="isCropDialogOpen = false"
    @confirm="applyCrop"
  />
  <LyricsCoverColorPicker
    v-if="isCoverColorPickerOpen"
    :cover-url="coverUrl"
    :locale="locale"
    :selected-color="displayedColor"
    @close="isCoverColorPickerOpen = false"
    @confirm="applyCoverColor"
  />
  <WallpaperEnginePicker
    v-if="isWallpaperPickerOpen"
    :locale="locale"
    :manual-root="value.wallpaperRoot"
    :selected-id="value.wallpaperProjectId"
    @close="isWallpaperPickerOpen = false"
    @select="selectWallpaper"
  />
</template>

<style scoped>
.background-panel {
  width: min(100%, 620px);
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-panel) 92%, var(--smw-bg-input));
}

.panel-disclosure {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.panel-disclosure:hover {
  background: var(--smw-bg-hover);
}

.panel-disclosure svg {
  flex: none;
  color: var(--smw-icon-muted);
  transition: transform 160ms ease;
}

.background-panel.collapsed .panel-disclosure svg {
  transform: rotate(-90deg);
}

.panel-heading,
.source-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
  text-align: left;
}

.panel-heading strong,
.source-copy strong {
  overflow: hidden;
  font-size: 13px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-heading small,
.source-copy small {
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 11px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-content {
  display: grid;
  gap: 8px;
  padding: 0 9px 9px;
}

.source-group {
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-canvas);
}

.source-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 9px;
  min-height: 56px;
  align-items: center;
  padding: 7px 8px;
}

.source-row + .source-row {
  border-top: 1px solid var(--smw-border);
}

.color-swatch,
.media-preview,
.wallpaper-mark {
  position: relative;
  display: grid;
  width: 42px;
  height: 34px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  background: var(--smw-bg-input);
}

.color-swatch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  opacity: 0;
  background: transparent;
  cursor: pointer;
}

.color-swatch input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-swatch input::-webkit-color-swatch {
  border: 0;
}

.media-preview img,
.media-preview video,
.wallpaper-mark img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-preview > span,
.wallpaper-mark {
  color: var(--smw-text-secondary);
  font-size: 10px;
  font-weight: 760;
}

.wallpaper-mark {
  color: var(--smw-text-body);
  background: var(--smw-bg-selected);
}

.media-actions {
  display: flex;
  gap: 5px;
  align-items: center;
}

.color-actions {
  display: flex;
  gap: 5px;
  align-items: center;
}

.source-action,
.reset-button {
  display: inline-grid;
  min-height: 28px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.source-action {
  padding: 0 10px;
}

.source-action:hover:not(:disabled),
.reset-button:hover:not(:disabled) {
  border-color: var(--smw-border-strong);
  background: var(--smw-bg-hover);
}

.source-action.active {
  border-color: var(--smw-border-strong);
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
}

.source-action:focus-visible,
.reset-button:focus-visible,
.panel-disclosure:focus-visible,
.slider-row input:focus-visible {
  outline: 2px solid var(--smw-button-primary);
  outline-offset: 2px;
}

.source-action:disabled,
.reset-button:disabled,
.slider-row input:disabled {
  cursor: default;
  opacity: 0.45;
}

.crop-controls {
  display: grid;
  gap: 6px;
}

.slider-row {
  display: grid;
  grid-template-columns: minmax(92px, 128px) minmax(120px, 1fr) 44px 28px;
  gap: 9px;
  min-height: 42px;
  align-items: center;
  padding: 6px 7px 6px 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-canvas);
  font-size: 12px;
}

.slider-row > span {
  font-weight: 620;
}

.slider-row input {
  width: 100%;
  min-width: 0;
  margin: 0;
  accent-color: var(--smw-button-primary);
  cursor: pointer;
}

.slider-row output {
  color: var(--smw-text-secondary);
  font-size: 11px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.reset-button {
  width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 0;
  color: var(--smw-icon-muted);
}

@media (max-width: 760px) {
  .source-row {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .source-row > .source-action,
  .media-actions,
  .color-actions {
    grid-column: 1 / -1;
    justify-self: stretch;
  }

  .media-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .color-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .slider-row {
    grid-template-columns: minmax(88px, 1fr) 44px 28px;
  }

  .slider-row input {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
