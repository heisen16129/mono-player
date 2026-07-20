<script setup lang="ts">
import { usePlayerStore } from '../stores/player';
import type { UserPlaylist } from '../types/music';
import SidebarAccount from './sidebar/SidebarAccount.vue';
import SidebarBrand from './sidebar/SidebarBrand.vue';
import SidebarNav from './sidebar/SidebarNav.vue';

const player = usePlayerStore();

defineProps<{
  activeView: 'library' | 'discover' | 'artists' | 'settings' | 'themes' | 'plugins' | 'downloads';
  activeCollection: 'all' | 'favorites';
  activeLibraryFilter: 'all' | 'recentAdded' | 'recentPlayed';
  activePlaylistId: string | null;
  collapsed: boolean;
  enablePlugins: boolean;
  playlists: UserPlaylist[];
  showDownloads: boolean;
}>();

const emit = defineEmits<{
  openArtists: [];
  openDiscover: [];
  openLibrary: [];
  openFavorites: [];
  openRecentAdded: [];
  openRecentPlayed: [];
  openSettings: [];
  openTheme: [];
  openPlugins: [];
  openDownloads: [];
  openPlaylist: [playlistId: string];
  createPlaylist: [];
  openPlaylistMenu: [playlist: UserPlaylist, x: number, y: number];
  toggleCollapsed: [];
}>();

</script>

<template>
  <aside class="primary-sidebar" :class="{ collapsed }">
    <SidebarBrand :collapsed="collapsed" :locale="player.settings.locale" @toggle-collapsed="emit('toggleCollapsed')" />

    <SidebarNav
      :active-view="activeView"
      :active-collection="activeCollection"
      :active-library-filter="activeLibraryFilter"
      :active-playlist-id="activePlaylistId"
      :collapsed="collapsed"
      :enable-plugins="enablePlugins"
      :locale="player.settings.locale"
      :playlists="playlists"
      :show-downloads="showDownloads"
      @open-artists="emit('openArtists')"
      @open-discover="emit('openDiscover')"
      @open-library="emit('openLibrary')"
      @open-favorites="emit('openFavorites')"
      @open-recent-added="emit('openRecentAdded')"
      @open-recent-played="emit('openRecentPlayed')"
      @open-plugins="emit('openPlugins')"
      @open-downloads="emit('openDownloads')"
      @open-playlist="emit('openPlaylist', $event)"
      @create-playlist="emit('createPlaylist')"
      @open-playlist-menu="(playlist, x, y) => emit('openPlaylistMenu', playlist, x, y)"
    />

    <SidebarAccount
      :active-view="activeView"
      :collapsed="collapsed"
      :locale="player.settings.locale"
      @open-settings="emit('openSettings')"
      @open-theme="emit('openTheme')"
    />
  </aside>
</template>

<style scoped>
.primary-sidebar {
  min-height: 0;
  border-right: 1px solid var(--smw-border);
}

.primary-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 16px 20px;
  overflow: hidden;
  background: var(--smw-bg-sidebar);
  transition:
    gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.primary-sidebar.collapsed {
  align-items: center;
  padding-inline: 10px;
}

</style>
