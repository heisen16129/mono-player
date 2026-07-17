<script setup lang="ts">
import { Plus, X } from '@lucide/vue';
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
  <div class="scan-dialog-overlay add-playlist-overlay" role="presentation" @click="$emit('close')">
    <section class="scan-dialog add-playlist-dialog" role="dialog" aria-modal="true" aria-label="添加到歌单" @click.stop>
      <header class="scan-dialog-head add-playlist-head">
        <h2>添加到歌单 <span>共 1 首</span></h2>
        <button class="icon-button" type="button" :aria-label="t(locale, 'close')" @click="$emit('close')">
          <X :size="18" />
        </button>
      </header>

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

.add-playlist-overlay {
  align-items: center;
}

.add-playlist-dialog {
  width: min(400px, calc(100vw - 32px));
  overflow: hidden;
}

.add-playlist-head {
  padding: 10px 12px;
}

.add-playlist-head h2 {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 16px;
}

.add-playlist-head h2 span {
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
