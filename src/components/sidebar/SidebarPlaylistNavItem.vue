<script setup lang="ts">
import { Music2 } from '@lucide/vue';
import type { UserPlaylist } from '../../types/music';

defineProps<{
  active: boolean;
  collapsed: boolean;
  playlist: UserPlaylist;
}>();

const emit = defineEmits<{
  openPlaylist: [playlistId: string];
  openPlaylistMenu: [playlist: UserPlaylist, x: number, y: number];
}>();

function openPlaylistMenu(playlist: UserPlaylist, event: MouseEvent) {
  emit('openPlaylistMenu', playlist, event.clientX, event.clientY);
}
</script>

<template>
  <button
    class="playlist-nav-item"
    :class="{ 'is-active': active, 'is-collapsed': collapsed }"
    type="button"
    :title="playlist.name"
    @click="emit('openPlaylist', playlist.id)"
    @contextmenu.prevent.stop="openPlaylistMenu(playlist, $event)"
  >
    <span class="nav-icon"><Music2 :size="21" /></span><span class="sidebar-text">{{ playlist.name }}</span>
  </button>
</template>

<style scoped>
.playlist-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  width: var(--sidebar-nav-item-width, 100%);
  height: 42px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  color: var(--smw-text-body);
  background: transparent;
  font-size: 14px;
  font-weight: 520;
  font-family: inherit;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition:
    width 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 160ms ease,
    color 180ms ease;
}

.playlist-nav-item:hover,
.playlist-nav-item.is-active {
  background: var(--smw-bg-selected);
}

.playlist-nav-item.is-collapsed {
  justify-content: flex-start;
  gap: 0;
  padding: 0;
  margin-left: 0;
}

.playlist-nav-item.is-collapsed:hover,
.playlist-nav-item.is-collapsed.is-active {
  background: var(--smw-bg-selected);
}

.playlist-nav-item.is-collapsed:hover .nav-icon,
.playlist-nav-item.is-collapsed.is-active .nav-icon {
  background: transparent;
}

.nav-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 58px;
  height: 42px;
  place-items: center;
  border-radius: 8px;
  flex: 0 0 58px;
}

.nav-icon svg {
  flex: 0 0 auto;
}

.sidebar-text {
  position: relative;
  z-index: 1;
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  opacity: 1;
  white-space: nowrap;
  transform: translateX(0);
  transition:
    max-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 120ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.playlist-nav-item.is-collapsed .sidebar-text {
  max-width: 0;
  opacity: 0;
  transform: translateX(-6px);
}
</style>
