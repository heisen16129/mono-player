<script setup lang="ts">
import { useScrollingState } from '../../composables/useScrollingState';
import type { SidebarPlaylistNavListEmits, SidebarPlaylistNavListProps } from '../../types/sidebar';
import type { UserPlaylist } from '../../types/music';
import SidebarPlaylistNavItem from './SidebarPlaylistNavItem.vue';

defineProps<SidebarPlaylistNavListProps>();

const emit = defineEmits<SidebarPlaylistNavListEmits>();

const { isScrolling: isPlaylistListScrolling, showScrolling: showPlaylistListScrolling } = useScrollingState();

function handlePlaylistListScroll() {
  showPlaylistListScrolling();
}

function openPlaylistMenu(playlist: UserPlaylist, x: number, y: number) {
  emit('openPlaylistMenu', playlist, x, y);
}
</script>

<template>
  <div
    class="playlist-nav-list sidebar-transient-scrollbar"
    :class="{ 'is-collapsed': collapsed, 'is-scrolling': isPlaylistListScrolling }"
    @scroll="handlePlaylistListScroll"
  >
    <SidebarPlaylistNavItem
      v-for="playlist in playlists"
      :key="playlist.id"
      :active="activePlaylistId === playlist.id"
      :collapsed="collapsed"
      :playlist="playlist"
      @open-playlist="emit('openPlaylist', $event)"
      @open-playlist-menu="openPlaylistMenu"
    />
  </div>
</template>

<style scoped>
.playlist-nav-list {
  display: grid;
  align-content: start;
  gap: 3px;
  flex: 1 1 auto;
  min-height: 0;
  margin-right: -10px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 10px;
}

</style>
