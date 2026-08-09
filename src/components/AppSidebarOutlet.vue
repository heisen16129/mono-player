<script setup lang="ts">
import { computed } from 'vue';
import PrimarySidebar from './PrimarySidebar.vue';
import type { AppSidebarOutletEmits, AppSidebarOutletProps, PrimarySidebarListeners, PrimarySidebarProps } from '../types/sidebar';

const props = defineProps<AppSidebarOutletProps>();

const emit = defineEmits<AppSidebarOutletEmits>();

const primarySidebarProps = computed<PrimarySidebarProps>(() => ({
  activeCollection: props.activeCollection,
  activeLibraryFilter: props.isLibraryPanelMode && props.activeLibraryFilter === 'recentAdded' ? 'all' : props.activeLibraryFilter,
  activePlaylistId: props.activePlaylistId,
  activeView: props.activeView,
  collapsed: props.collapsed,
  enablePlugins: props.enablePlugins,
  hasMusicSourcePlugin: props.hasMusicSourcePlugin,
  playlists: props.playlists,
  showDownloads: props.showDownloads,
}));

const primarySidebarListeners: PrimarySidebarListeners = {
  onCreatePlaylist: () => emit('createPlaylist'),
  onOpenArtists: () => emit('openArtists'),
  onOpenDiscover: () => emit('openDiscover'),
  onOpenDownloads: () => emit('openDownloads'),
  onOpenFavorites: () => emit('openFavorites'),
  onOpenLibrary: () => emit('openLibrary'),
  onOpenPlaylist: (...args) => emit('openPlaylist', ...args),
  onOpenPlaylistMenu: (...args) => emit('openPlaylistMenu', ...args),
  onOpenPlugins: () => emit('openPlugins'),
  onOpenRecentAdded: () => emit('openRecentAdded'),
  onOpenRecentPlayed: () => emit('openRecentPlayed'),
  onOpenSettings: () => emit('openSettings'),
  onOpenTheme: () => emit('openTheme'),
  onToggleCollapsed: () => emit('toggleCollapsed'),
};
</script>

<template>
  <PrimarySidebar
    v-bind="{ ...primarySidebarProps, ...primarySidebarListeners }"
  />
</template>


