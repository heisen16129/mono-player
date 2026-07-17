<script setup lang="ts">
import { X } from '@lucide/vue';
import { computed } from 'vue';
import { resolveLocale, t } from '../i18n';
import type { Locale } from '../types/music';

const props = defineProps<{
  editing: boolean;
  locale: Locale;
  name: string;
}>();

const emit = defineEmits<{
  'update:name': [value: string];
  close: [];
  confirm: [];
}>();

const isEnglish = computed(() => resolveLocale(props.locale) === 'en-US');
const title = computed(() => props.editing ? (isEnglish.value ? 'Rename playlist' : '重命名歌单') : (isEnglish.value ? 'Create playlist' : '创建歌单'));
</script>

<template>
  <div class="scan-dialog-overlay" role="presentation">
    <section class="scan-dialog playlist-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <header class="scan-dialog-head">
        <h2>{{ title }}</h2>
        <button class="icon-button" type="button" :aria-label="t(locale, 'close')" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>

      <form class="playlist-dialog-form" @submit.prevent="$emit('confirm')">
        <div class="playlist-dialog-body">
          <label class="playlist-name-field">
            <span>{{ isEnglish ? 'Playlist name' : '歌单名称' }}</span>
            <input
              :value="name"
              type="text"
              :placeholder="isEnglish ? 'New playlist' : '新建歌单'"
              @input="emit('update:name', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>

        <footer class="scan-dialog-actions">
          <button class="secondary-button" type="button" @click="$emit('close')">
            {{ t(locale, 'close') }}
          </button>
          <button class="confirm-button" type="submit" :disabled="!name.trim()">
            {{ t(locale, 'confirm') }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.scan-dialog-overlay {
  position: fixed;
  inset: 0 0 var(--player-height) 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--smw-bg-canvas) 82%, transparent);
  backdrop-filter: blur(10px);
}

.scan-dialog {
  display: grid;
  width: min(490px, calc(100vw - 32px));
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-workspace);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
}

.scan-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.scan-dialog-head h2 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 17px;
  font-weight: 560;
}

.playlist-dialog {
  width: min(420px, calc(100vw - 32px));
}

.playlist-dialog-body {
  padding: 12px 12px 18px;
}

.playlist-name-field {
  display: grid;
  gap: 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.playlist-name-field input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  outline: none;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
  font: inherit;
}

.playlist-name-field input:focus {
  border-color: var(--smw-border-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
}

.scan-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 16px 12px 12px;
}

.secondary-button {
  display: inline-grid;
  min-width: 52px;
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
  min-width: 52px;
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
</style>
