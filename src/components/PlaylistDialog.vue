<script setup lang="ts">
import { computed } from 'vue';
import { resolveLocale, t } from '../i18n';
import type { Locale } from '../types/music';
import BaseDialog from './BaseDialog.vue';
import PlaylistCoverPicker from './PlaylistCoverPicker.vue';
import PlaylistNameField from './PlaylistNameField.vue';

const props = defineProps<{
  cover: string | null;
  editing: boolean;
  locale: Locale;
  name: string;
}>();

const emit = defineEmits<{
  'update:name': [value: string];
  chooseCover: [];
  clearCover: [];
  close: [];
  confirm: [];
}>();

const isEnglish = computed(() => resolveLocale(props.locale) === 'en-US');
const chooseCoverLabel = computed(() => isEnglish.value ? 'Choose cover' : '\u9009\u62e9\u5c01\u9762');
const clearCoverLabel = computed(() => isEnglish.value ? 'Remove cover' : '\u79fb\u9664\u5c01\u9762');
const title = computed(() => props.editing ? (isEnglish.value ? 'Rename playlist' : '重命名歌单') : (isEnglish.value ? 'Create playlist' : '创建歌单'));
</script>

<template>
  <BaseDialog :label="title" :close-label="t(locale, 'close')" :title="title" width="min(420px, calc(100vw - 32px))" @close="$emit('close')">

      <form class="playlist-dialog-form" @submit.prevent="$emit('confirm')">
        <div class="playlist-dialog-body">
          <PlaylistCoverPicker
            v-if="!editing"
            :choose-label="chooseCoverLabel"
            :clear-label="clearCoverLabel"
            :cover="cover"
            @choose="emit('chooseCover')"
            @clear="emit('clearCover')"
          />
          <PlaylistNameField
            :label="isEnglish ? 'Playlist name' : '歌单名称'"
            :name="name"
            :placeholder="isEnglish ? 'New playlist' : '新建歌单'"
            @update:name="emit('update:name', $event)"
          />
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
  display: grid;
  gap: 18px;
  padding: 16px 18px 20px;
}

.scan-dialog-actions {
  --button-min-height: 32px;
  --button-padding-x: 16px;
  --button-min-width: 58px;

  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 18px 16px;
  border-top: 1px solid var(--smw-border-soft);
}

</style>
