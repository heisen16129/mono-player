<script setup lang="ts">
import { computed } from 'vue';
import { resolveLocale, t } from '../i18n';
import type { Locale } from '../types/music';
import BaseDialog from './BaseDialog.vue';

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
  <BaseDialog :label="title" :close-label="t(locale, 'close')" :title="title" width="min(420px, calc(100vw - 32px))" @close="$emit('close')">

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
  </BaseDialog>
</template>

<style scoped>
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
  --button-min-height: 30px;
  --button-padding-x: 14px;

  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 16px 12px 12px;
}

</style>
