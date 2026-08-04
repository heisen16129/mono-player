<script setup lang="ts">
import { Plus } from '@lucide/vue';
import FolderCover from './FolderCover.vue';
import type { Track, UserPlaylist } from '../types/music';

defineProps<{
  playlists: UserPlaylist[];
  tracksForPlaylist: (playlist: UserPlaylist) => Track[];
}>();

const emit = defineEmits<{
  addTrack: [playlist: UserPlaylist];
  createPlaylist: [];
}>();
</script>

<template>
  <div class="add-playlist-list">
    <button class="add-playlist-row" type="button" @click="emit('createPlaylist')">
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
      @click="emit('addTrack', playlist)"
    >
      <FolderCover class="add-playlist-cover" :cover-url="playlist.cover" :tracks="tracksForPlaylist(playlist)" tone="night" />
      <span>{{ playlist.name }}</span>
    </button>
  </div>
</template>

<style scoped>
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
