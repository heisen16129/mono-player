<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '../i18n';
import type { Locale, Track } from '../types/music';
import BaseDialog from './BaseDialog.vue';

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

watch(
  () => props.track,
  (track) => {
    title.value = track.title ?? '';
    artist.value = track.artist ?? '';
    album.value = track.album ?? '';
    year.value = track.year ? String(track.year) : '';
    genre.value = track.genre ?? '';
    trackNumber.value = track.trackNumber ? String(track.trackNumber) : '';
  },
);

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
  <BaseDialog label="更改元数据" :close-label="t(locale, 'close')" :close-disabled="saving" close-on-overlay width="min(460px, calc(100vw - 32px))" :z-index="360" @close="$emit('close')">
    <template #header>
      <div class="metadata-dialog-title">
        <h2>更改元数据</h2>
        <p>{{ track.title }}</p>
      </div>
    </template>

      <form class="metadata-dialog-form" @submit.prevent="submit">
        <label class="metadata-field">
          <span>歌名</span>
          <input v-model="title" type="text" autocomplete="off" placeholder="请输入歌名" required />
        </label>

        <label class="metadata-field">
          <span>艺术家</span>
          <input v-model="artist" type="text" autocomplete="off" placeholder="请输入艺术家" />
        </label>

        <label class="metadata-field">
          <span>专辑</span>
          <input v-model="album" type="text" autocomplete="off" placeholder="请输入专辑" />
        </label>

        <div class="metadata-field-grid">
          <label class="metadata-field">
            <span>年份</span>
            <input v-model="year" type="number" inputmode="numeric" min="1000" max="9999" autocomplete="off" placeholder="例如 2024" />
          </label>

          <label class="metadata-field">
            <span>音轨号</span>
            <input v-model="trackNumber" type="number" inputmode="numeric" min="1" autocomplete="off" placeholder="例如 1" />
          </label>
        </div>

        <label class="metadata-field">
          <span>流派</span>
          <input v-model="genre" type="text" autocomplete="off" placeholder="请输入流派" />
        </label>

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
:deep(.base-dialog-head) {
  align-items: flex-start;
}

.metadata-dialog-title h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 560;
}

.metadata-dialog-title p {
  max-width: 340px;
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-dialog-form {
  display: grid;
  gap: 12px;
  padding: 14px 12px 12px;
}

.metadata-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metadata-field {
  display: grid;
  gap: 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.metadata-field input {
  height: 38px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
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
  color: #dc2626;
  font-size: 12px;
}

.metadata-dialog-actions {
  --button-min-height: 30px;
  --button-padding-x: 14px;
  --button-min-width: 56px;

  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
}

@media (max-width: 520px) {
  .metadata-field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
