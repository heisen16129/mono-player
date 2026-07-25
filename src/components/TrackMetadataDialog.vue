<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n';
import { readCoverThumbnail, readTrackAudioInfo } from '../services/music';
import type { TrackAudioInfo } from '../services/music';
import type { Locale, Track } from '../types/music';
import { coverImageObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';
import { folderTitle } from '../utils/path';
import BaseDialog from './BaseDialog.vue';
import DefaultCover from './DefaultCover.vue';

export interface TrackMetadataFormValue {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  trackNumber: string;
}

const props = defineProps<{
  track: Track;
  saving?: boolean;
  error?: string | null;
  locale: Locale;
}>();

const emit = defineEmits<{
  close: [];
  save: [value: TrackMetadataFormValue];
}>();

const title = ref(props.track.title ?? '');
const artist = ref(props.track.artist ?? '');
const album = ref(props.track.album ?? '');
const year = ref(props.track.year ? String(props.track.year) : '');
const genre = ref(props.track.genre ?? '');
const trackNumber = ref(props.track.trackNumber ? String(props.track.trackNumber) : '');
const coverPreviewUrl = ref('');
const audioInfo = ref<TrackAudioInfo | null>(null);

let coverLoadId = 0;
let audioInfoLoadId = 0;
let temporaryCoverUrl: string | null = null;

const fileName = computed(() => folderTitle(props.track.path));
const bitrateLabel = computed(() => audioInfo.value?.bitrateKbps ? `${audioInfo.value.bitrateKbps} kbps` : '未知');
const sampleRateLabel = computed(() => formatSampleRate(audioInfo.value?.sampleRateHz));
const channelsLabel = computed(() => formatChannels(audioInfo.value?.channels));
const fileSizeLabel = computed(() => formatFileSize(audioInfo.value?.fileSizeBytes));
const addedAtLabel = computed(() => formatMetadataDate(props.track.addedAt));
const filePathLabel = computed(() => props.track.path || '未知');

watch(
  () => props.track,
  (track) => {
    title.value = track.title ?? '';
    artist.value = track.artist ?? '';
    album.value = track.album ?? '';
    year.value = track.year ? String(track.year) : '';
    genre.value = track.genre ?? '';
    trackNumber.value = track.trackNumber ? String(track.trackNumber) : '';
    void loadCoverPreview(track);
    void loadAudioInfo(track);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  coverLoadId += 1;
  audioInfoLoadId += 1;
  clearTemporaryCoverUrl();
});

function clearTemporaryCoverUrl() {
  revokeTemporaryObjectUrl(temporaryCoverUrl);
  temporaryCoverUrl = null;
}

function formatMetadataDate(value: string | null | undefined) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(props.locale === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
}

function formatSampleRate(value: number | null | undefined) {
  if (!value) return '未知';
  return `${(value / 1000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} kHz`;
}

function formatChannels(value: number | null | undefined) {
  if (!value) return '未知';
  if (value === 1) return '1 单声道';
  if (value === 2) return '2 立体声';
  return `${value} 声道`;
}

function formatFileSize(value: number | null | undefined) {
  if (!value) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toLocaleString('zh-CN', { maximumFractionDigits: unitIndex === 0 ? 0 : 2 })} ${units[unitIndex]}`;
}

async function loadAudioInfo(track: Track) {
  const currentLoadId = ++audioInfoLoadId;
  audioInfo.value = null;

  const info = await readTrackAudioInfo({ path: track.path }).catch(() => null);
  if (currentLoadId !== audioInfoLoadId) return;
  audioInfo.value = info;
}

async function loadCoverPreview(track: Track) {
  const currentLoadId = ++coverLoadId;
  clearTemporaryCoverUrl();

  const artworkUrl = usableArtworkDisplaySrc(track.associatedArtwork ?? track.artwork);
  if (artworkUrl) {
    coverPreviewUrl.value = artworkUrl;
    return;
  }

  coverPreviewUrl.value = '';
  const cover = await readCoverThumbnail(track.path).catch(() => null);
  if (currentLoadId !== coverLoadId) return;

  const objectUrl = coverImageObjectUrl(cover);
  if (!objectUrl) return;
  temporaryCoverUrl = objectUrl;
  coverPreviewUrl.value = objectUrl;
}

function handleCoverError() {
  coverPreviewUrl.value = '';
  clearTemporaryCoverUrl();
}

function submit() {
  if (props.saving || !title.value.trim()) return;
  emit('save', {
    title: title.value,
    artist: artist.value,
    album: album.value,
    year: year.value,
    genre: genre.value,
    trackNumber: trackNumber.value,
  });
}
</script>

<template>
  <BaseDialog
    label="更改元数据"
    :close-label="t(locale, 'close')"
    :close-disabled="saving"
    close-on-overlay
    width="min(760px, calc(100vw - 32px))"
    max-height="min(620px, calc(100vh - var(--player-height) - 48px))"
    grid-template-rows="auto minmax(0, 1fr)"
    overflow="hidden"
    panel-class="metadata-dialog-panel"
    :z-index="360"
    @close="$emit('close')"
  >
    <template #header>
      <div class="metadata-dialog-title">
        <h2>更改元数据</h2>
        <p>{{ track.title }}</p>
      </div>
    </template>

    <form class="metadata-dialog-form" @submit.prevent="submit">
      <div class="metadata-dialog-body">
        <aside class="metadata-summary">
          <div class="metadata-cover" :class="{ 'has-cover': coverPreviewUrl }">
            <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="" @error="handleCoverError" />
            <DefaultCover v-else :size="56" :stroke-width="2.2" />
          </div>

          <dl class="metadata-file-info">
            <div>
              <dt>码率</dt>
              <dd>{{ bitrateLabel }}</dd>
            </div>
            <div>
              <dt>采样率</dt>
              <dd>{{ sampleRateLabel }}</dd>
            </div>
            <div>
              <dt>声道数</dt>
              <dd>{{ channelsLabel }}</dd>
            </div>
            <div>
              <dt>文件大小</dt>
              <dd>{{ fileSizeLabel }}</dd>
            </div>
            <div>
              <dt>文件名</dt>
              <dd :title="fileName">{{ fileName }}</dd>
            </div>
            <div>
              <dt>文件位置</dt>
              <dd :title="filePathLabel">{{ filePathLabel }}</dd>
            </div>
            <div>
              <dt>添加日期</dt>
              <dd>{{ addedAtLabel }}</dd>
            </div>
          </dl>
        </aside>

        <section class="metadata-editor" aria-label="歌曲信息">
          <label class="metadata-field">
            <span>名称</span>
            <input v-model="title" type="text" autocomplete="off" placeholder="请输入歌曲名称" required />
          </label>

          <label class="metadata-field">
            <span>专辑</span>
            <input v-model="album" type="text" autocomplete="off" placeholder="请输入专辑" />
          </label>

          <label class="metadata-field">
            <span>艺术家</span>
            <input v-model="artist" type="text" autocomplete="off" placeholder="请输入艺术家" />
          </label>

          <label class="metadata-field">
            <span>年份</span>
            <input v-model="year" type="number" inputmode="numeric" min="1000" max="9999" autocomplete="off" placeholder="例如 2024" />
          </label>

          <label class="metadata-field">
            <span>歌曲序号</span>
            <input v-model="trackNumber" type="number" inputmode="numeric" min="1" autocomplete="off" placeholder="例如 1" />
          </label>

          <label class="metadata-field">
            <span>风格</span>
            <input v-model="genre" type="text" autocomplete="off" placeholder="请输入风格" />
          </label>
        </section>
      </div>

      <p v-if="error" class="metadata-error">{{ error }}</p>

      <footer class="metadata-dialog-actions">
        <button class="secondary-button" type="button" :disabled="saving" @click="$emit('close')">
          取消
        </button>
        <button class="confirm-button" type="submit" :disabled="saving || !title.trim()">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </footer>
    </form>
  </BaseDialog>
</template>

<style scoped>
.metadata-dialog-title h2 {
  margin: 0;
  color: var(--smw-text-primary);
}

.metadata-dialog-title p {
  max-width: 520px;
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-dialog-form {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  min-height: 0;
  overflow: hidden;
}

.metadata-dialog-body {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 24px;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 12px;
}

.metadata-summary {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.metadata-cover {
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: color-mix(in srgb, var(--smw-text-secondary) 70%, transparent);
  background: color-mix(in srgb, var(--smw-bg-input) 88%, transparent);
}

.metadata-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.metadata-file-info {
  display: grid;
  gap: 8px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.metadata-file-info div {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
}

.metadata-file-info dt {
  color: var(--smw-text-secondary);
}

.metadata-file-info dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--smw-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-editor {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.metadata-field {
  display: grid;
  gap: 6px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.metadata-field input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  outline: none;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font: inherit;
}

.metadata-field input:focus {
  border-color: var(--smw-border-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
}

.metadata-error {
  margin: 0;
  padding: 0 18px 8px;
  color: #dc2626;
  font-size: 12px;
}

.metadata-dialog-actions {
  --button-min-height: 32px;
  --button-padding-x: 16px;
  --button-min-width: 70px;

  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 16px;
}

@media (max-width: 720px) {
  .metadata-dialog-body {
    grid-template-columns: 1fr;
  }

  .metadata-cover {
    max-width: 220px;
  }
}
</style>
