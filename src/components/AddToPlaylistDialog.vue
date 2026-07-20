<script setup lang="ts">
import { Plus } from '@lucide/vue';
import BaseDialog from './BaseDialog.vue';
import FolderCover from './FolderCover.vue';
import { t } from '../i18n';
import type { Locale, Track, UserPlaylist } from '../types/music';

defineProps<{
  locale: Locale;
  playlists: UserPlaylist[];
  track: Track;
  tracksForPlaylist: (playlist: UserPlaylist) => Track[];
}>();

defineEmits<{
  close: [];
  createPlaylist: [];
  addTrack: [track: Track, playlist: UserPlaylist];
}>();
</script>

<template>
  <BaseDialog label="添加到歌单" :close-label="t(locale, 'close')" close-on-overlay panel-class="add-playlist-dialog" width="min(400px, calc(100vw - 32px))" @close="$emit('close')">
    <template #header>
      <h2 class="add-playlist-title">添加到歌单 <span>共 1 首</span></h2>
    </template>

      <div class="add-playlist-list">
        <button class="add-playlist-row" type="button" @click="$emit('createPlaylist')">
          <span class="add-playlist-create-cover">
            <Plus :size="26" />
          </span>
          <span>新建歌单</span>
        </button>
        <button
          v-for="playlist in playlists"
          :key="playlist.id"
          class="add-playlist-row"
          type="button"
          @click="$emit('addTrack', track, playlist)"
        >
          <FolderCover class="add-playlist-cover" :tracks="tracksForPlaylist(playlist)" tone="night" />
          <span>{{ playlist.name }}</span>
        </button>
      </div>
  </BaseDialog>
</template>

<style scoped>
:deep(.add-playlist-dialog) {
  overflow: hidden;
}

:deep(.add-playlist-dialog .base-dialog-head) {
  padding: 10px 12px;
}

.add-playlist-title {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 16px;
  font-weight: 560;
}

.add-playlist-title span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-weight: 420;
}

.add-playlist-list {
  display: grid;
  max-height: min(420px, calc(100vh - 150px));
  overflow: auto;
}

.add-playlist-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 8px 14px;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.add-playlist-row:hover,
.add-playlist-row:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.add-playlist-row span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-playlist-cover.folder-cover,
.add-playlist-create-cover {
  width: 46px;
  height: 46px;
  border-radius: 7px;
}

.add-playlist-create-cover {
  display: grid;
  place-items: center;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-muted);
}
</style>
