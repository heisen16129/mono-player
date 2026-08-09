<script setup lang="ts">
import { computed } from 'vue';
import type {
  SidebarMainNavLinksListeners,
  SidebarMainNavLinksProps,
  SidebarNavEmits,
  SidebarNavProps,
  SidebarFavoritesNavLinkListeners,
  SidebarFavoritesNavLinkProps,
  SidebarPlaylistCreateControlListeners,
  SidebarPlaylistCreateControlProps,
  SidebarPlaylistNavListListeners,
  SidebarPlaylistNavListProps,
} from '../../types/sidebar';
import SidebarFavoritesNavLink from './SidebarFavoritesNavLink.vue';
import SidebarMainNavLinks from './SidebarMainNavLinks.vue';
import SidebarPlaylistCreateControl from './SidebarPlaylistCreateControl.vue';
import SidebarPlaylistNavList from './SidebarPlaylistNavList.vue';

const props = defineProps<SidebarNavProps>();

const emit = defineEmits<SidebarNavEmits>();

const sidebarMainNavLinksProps = computed<SidebarMainNavLinksProps>(() => ({
  activeCollection: props.activeCollection,
  activeLibraryFilter: props.activeLibraryFilter,
  activeView: props.activeView,
  collapsed: props.collapsed,
  enablePlugins: props.enablePlugins,
  hasMusicSourcePlugin: props.hasMusicSourcePlugin,
  locale: props.locale,
  showDownloads: props.showDownloads,
}));

const sidebarMainNavLinksListeners: SidebarMainNavLinksListeners = {
  onOpenArtists: () => emit('openArtists'),
  onOpenDiscover: () => emit('openDiscover'),
  onOpenDownloads: () => emit('openDownloads'),
  onOpenLibrary: () => emit('openLibrary'),
  onOpenPlugins: () => emit('openPlugins'),
  onOpenRecentAdded: () => emit('openRecentAdded'),
  onOpenRecentPlayed: () => emit('openRecentPlayed'),
};

const sidebarPlaylistNavListProps = computed<SidebarPlaylistNavListProps>(() => ({
  activePlaylistId: props.activePlaylistId,
  collapsed: props.collapsed,
  playlists: props.playlists,
}));

const sidebarPlaylistNavListListeners: SidebarPlaylistNavListListeners = {
  onOpenPlaylist: (...args) => emit('openPlaylist', ...args),
  onOpenPlaylistMenu: (...args) => emit('openPlaylistMenu', ...args),
};

const sidebarPlaylistCreateControlProps = computed<SidebarPlaylistCreateControlProps>(() => ({
  collapsed: props.collapsed,
  locale: props.locale,
}));

const sidebarPlaylistCreateControlListeners: SidebarPlaylistCreateControlListeners = {
  onCreatePlaylist: () => emit('createPlaylist'),
};

const sidebarFavoritesNavLinkProps = computed<SidebarFavoritesNavLinkProps>(() => ({
  active: props.activeView === 'library' && props.activeCollection === 'favorites',
  collapsed: props.collapsed,
  locale: props.locale,
}));

const sidebarFavoritesNavLinkListeners: SidebarFavoritesNavLinkListeners = {
  onOpenFavorites: () => emit('openFavorites'),
};
</script>

<template>
  <nav class="main-nav" :class="{ 'is-collapsed': collapsed }" aria-label="Main navigation">
    <SidebarMainNavLinks
      v-bind="{ ...sidebarMainNavLinksProps, ...sidebarMainNavLinksListeners }"
    />
    <SidebarPlaylistCreateControl
      v-bind="{ ...sidebarPlaylistCreateControlProps, ...sidebarPlaylistCreateControlListeners }"
    />
    <SidebarFavoritesNavLink
      v-bind="{ ...sidebarFavoritesNavLinkProps, ...sidebarFavoritesNavLinkListeners }"
    />
    <SidebarPlaylistNavList
      v-bind="{ ...sidebarPlaylistNavListProps, ...sidebarPlaylistNavListListeners }"
    />
  </nav>
</template>

<style scoped>
.main-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

</style>


