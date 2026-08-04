<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../stores/player';
import type { PrimarySidebarEmits, PrimarySidebarProps, SidebarNavListeners, SidebarNavProps } from '../types/sidebar';
import SidebarAccount from './sidebar/SidebarAccount.vue';
import SidebarBrand from './sidebar/SidebarBrand.vue';
import SidebarNav from './sidebar/SidebarNav.vue';

const player = usePlayerStore();

const props = defineProps<PrimarySidebarProps>();

const emit = defineEmits<PrimarySidebarEmits>();

const sidebarNavProps = computed<SidebarNavProps>(() => ({
  activeCollection: props.activeCollection,
  activeLibraryFilter: props.activeLibraryFilter,
  activePlaylistId: props.activePlaylistId,
  activeView: props.activeView,
  collapsed: props.collapsed,
  enablePlugins: props.enablePlugins,
  locale: player.settings.locale,
  playlists: props.playlists,
  showDownloads: props.showDownloads,
}));

const sidebarNavListeners: SidebarNavListeners = {
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
};

</script>

<template>
  <aside class="primary-sidebar" :class="{ collapsed }">
    <SidebarBrand :collapsed="collapsed" :locale="player.settings.locale" @toggle-collapsed="emit('toggleCollapsed')" />

    <SidebarNav
      v-bind="{ ...sidebarNavProps, ...sidebarNavListeners }"
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
  height: 100%;
  min-height: 0;
  border-right: 1px solid var(--smw-border);
}

.primary-sidebar {
  --sidebar-nav-item-width: calc(var(--sidebar-width) - 26px);
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 16px 18px 10px;
  overflow: hidden;
  background: var(--smw-bg-sidebar);
  transition:
    gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.primary-sidebar.collapsed {
  --sidebar-nav-item-width: 58px;
  align-items: center;
  overflow: visible;
  padding-inline: 10px;
}

</style>
