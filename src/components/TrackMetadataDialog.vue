<script setup lang="ts">
import { X } from '@lucide/vue';
import { ref, watch } from 'vue';
import { t } from '../i18n';
import type { Locale, Track } from '../types/music';

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
  <div class="metadata-dialog-overlay" role="presentation" @click.self="$emit('close')">
    <section class="metadata-dialog" role="dialog" aria-modal="true" aria-label="更改元数据">
      <header class="metadata-dialog-head">
        <div>
          <h2>更改元数据</h2>
          <p>{{ track.title }}</p>
        </div>
        <button class="icon-button" type="button" :aria-label="t(locale, 'close')" :disabled="saving" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>

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
    </section>
  </div>
</template>

<style scoped>
.metadata-dialog-overlay {
  position: fixed;
  inset: 0 0 var(--player-height) 0;
  z-index: 360;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--smw-bg-canvas) 82%, transparent);
  backdrop-filter: blur(10px);
}

.metadata-dialog {
  display: grid;
  width: min(460px, calc(100vw - 32px));
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-workspace);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
}

.metadata-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.metadata-dialog-head h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 560;
}

.metadata-dialog-head p {
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
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
}

.secondary-button {
  display: inline-grid;
  min-height: 30px;
  place-items: center;
  padding: 0 14px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  cursor: pointer;
  white-space: nowrap;
}

.secondary-button:hover {
  background: var(--smw-bg-hover);
}

.confirm-button {
  min-width: 56px;
  min-height: 30px;
  border: 1px solid var(--smw-button-primary);
  border-radius: 8px;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
  font-weight: 560;
}

.confirm-button:hover {
  filter: brightness(0.96);
}

.secondary-button:disabled,
.confirm-button:disabled {
  cursor: default;
  filter: none;
}

.confirm-button:disabled {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: #fff;
  background: color-mix(in srgb, var(--smw-button-primary) 62%, var(--smw-bg-input));
  opacity: 1;
}

@media (max-width: 520px) {
  .metadata-field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
