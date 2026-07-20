<script setup lang="ts">
import { CirclePlus, Clock3, Download, Heart, Music2, Plug, Plus, Search, UserRound } from '@lucide/vue';
import { useScrollingState } from '../../composables/useScrollingState';
import { t } from '../../i18n';
import type { Locale, UserPlaylist } from '../../types/music';

defineProps<{
  activeView: 'library' | 'discover' | 'artists' | 'settings' | 'themes' | 'plugins' | 'downloads';
  activeCollection: 'all' | 'favorites';
  activeLibraryFilter: 'all' | 'recentAdded' | 'recentPlayed';
  activePlaylistId: string | null;
  collapsed: boolean;
  enablePlugins: boolean;
  locale: Locale;
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
  openPlugins: [];
  openDownloads: [];
  openPlaylist: [playlistId: string];
  createPlaylist: [];
  openPlaylistMenu: [playlist: UserPlaylist, x: number, y: number];
}>();

const { isScrolling: isPlaylistListScrolling, showScrolling: showPlaylistListScrolling } = useScrollingState();

function handlePlaylistListScroll() {
  showPlaylistListScrolling();
}
</script>

<template>
  <nav class="main-nav" :class="{ 'is-collapsed': collapsed }" aria-label="Main navigation">
    <a
      v-if="enablePlugins"
      :class="{ 'is-active': activeView === 'discover' }"
      href="#discover"
      title="发现音乐"
      @click.prevent="emit('openDiscover')"
    >
      <span class="nav-icon"><Search :size="22" /></span><span class="sidebar-text">发现音乐</span>
    </a>
    <a
      :class="{ 'is-active': activeView === 'library' && activeCollection === 'all' && activeLibraryFilter === 'all' }"
      href="#library"
      :title="t(locale, 'localMusic')"
      @click.prevent="emit('openLibrary')"
    >
      <span class="nav-icon"><Music2 :size="22" /></span><span class="sidebar-text">{{ t(locale, 'localMusic') }}</span>
    </a>
    <a
      :class="{ 'is-active': activeView === 'artists' }"
      href="#artists"
      :title="t(locale, 'artists')"
      @click.prevent="emit('openArtists')"
    >
      <span class="nav-icon"><UserRound :size="22" /></span><span class="sidebar-text">{{ t(locale, 'artists') }}</span>
    </a>
    <a
      :class="{ 'is-active': activeView === 'library' && activeLibraryFilter === 'recentAdded' }"
      href="#recent-added"
      :title="t(locale, 'recentAdded')"
      @click.prevent="emit('openRecentAdded')"
    >
      <span class="nav-icon"><CirclePlus :size="22" /></span><span class="sidebar-text">{{ t(locale, 'recentAdded') }}</span>
    </a>
    <a
      :class="{ 'is-active': activeView === 'library' && activeLibraryFilter === 'recentPlayed' }"
      href="#recent-played"
      :title="t(locale, 'recentPlayed')"
      @click.prevent="emit('openRecentPlayed')"
    >
      <span class="nav-icon"><Clock3 :size="22" /></span><span class="sidebar-text">{{ t(locale, 'recentPlayed') }}</span>
    </a>
    <a
      v-if="showDownloads"
      :class="{ 'is-active': activeView === 'downloads' }"
      href="#downloads"
      title="下载管理"
      @click.prevent="emit('openDownloads')"
    >
      <span class="nav-icon"><Download :size="22" /></span><span class="sidebar-text">下载管理</span>
    </a>
    <a
      v-if="enablePlugins"
      :class="{ 'is-active': activeView === 'plugins' }"
      href="#plugins"
      title="插件管理"
      @click.prevent="emit('openPlugins')"
    >
      <span class="nav-icon"><Plug :size="22" /></span><span class="sidebar-text">插件管理</span>
    </a>
    <span class="nav-section-break">
      <span class="nav-divider" aria-hidden="true"></span>
      <button
        class="nav-add-button"
        type="button"
        :aria-label="locale === 'en-US' ? 'Create playlist' : '创建歌单'"
        :title="locale === 'en-US' ? 'Create playlist' : '创建歌单'"
        @click="emit('createPlaylist')"
      >
        <Plus :size="17" />
      </button>
    </span>
    <a
      :class="{ 'is-active': activeView === 'library' && activeCollection === 'favorites' }"
      href="#favorites"
      :title="t(locale, 'favorites')"
      @click.prevent="emit('openFavorites')"
    >
      <span class="nav-icon"><Heart :size="22" /></span><span class="sidebar-text">{{ t(locale, 'favorites') }}</span>
    </a>
    <div
      class="playlist-nav-list"
      :class="{ 'is-scrolling': isPlaylistListScrolling }"
      @scroll="handlePlaylistListScroll"
    >
      <button
        v-for="playlist in playlists"
        :key="playlist.id"
        class="playlist-nav-item"
        :class="{ 'is-active': activePlaylistId === playlist.id }"
        type="button"
        :title="playlist.name"
        @click="emit('openPlaylist', playlist.id)"
        @contextmenu.prevent.stop="emit('openPlaylistMenu', playlist, $event.clientX, $event.clientY)"
      >
        <span class="nav-icon"><Music2 :size="21" /></span><span class="sidebar-text">{{ playlist.name }}</span>
      </button>
    </div>
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

.nav-section-break {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
  align-items: center;
  height: 34px;
  margin: 5px 0 6px 8px;
}

.nav-divider {
  display: block;
  height: 1px;
  background: var(--smw-border);
}

.nav-add-button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.nav-add-button:hover {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.main-nav.is-collapsed .nav-section-break {
  width: 58px;
  margin: 5px 0 6px;
  grid-template-columns: 58px;
}

.main-nav.is-collapsed .nav-divider {
  display: none;
}

.main-nav.is-collapsed .nav-add-button {
  width: 58px;
  height: 34px;
  margin: 0;
}

.main-nav a,
.playlist-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 2px;
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
    background-color 160ms ease,
    color 180ms ease;
}

.playlist-nav-item {
  height: 42px;
}

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
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.playlist-nav-list:hover.is-scrolling {
  -ms-overflow-style: auto;
  scrollbar-width: thin;
}

.playlist-nav-list::-webkit-scrollbar {
  display: none;
  width: 0;
}

.playlist-nav-list:hover.is-scrolling::-webkit-scrollbar {
  display: block;
  width: 4px;
}

.playlist-nav-list::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.playlist-nav-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: transparent;
}

.playlist-nav-list:hover.is-scrolling::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--smw-text-muted) 32%, transparent);
}

.playlist-nav-list::-webkit-scrollbar-track {
  background: transparent;
}

.main-nav.is-collapsed a,
.main-nav.is-collapsed .playlist-nav-item {
  justify-content: flex-start;
  gap: 0;
  width: 58px;
  padding: 0;
  margin-left: 0;
}

.nav-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 58px;
  height: 48px;
  place-items: center;
  border-radius: 8px;
  flex: 0 0 58px;
}

.nav-icon svg {
  flex: 0 0 auto;
}

.playlist-nav-item .nav-icon {
  width: 58px;
  height: 42px;
  flex-basis: 58px;
}

.main-nav a .sidebar-text,
.playlist-nav-item .sidebar-text {
  position: relative;
  z-index: 1;
}

.main-nav a:hover,
.playlist-nav-item:hover,
.main-nav .is-active {
  background: var(--smw-bg-selected);
}

.main-nav.is-collapsed a:hover,
.main-nav.is-collapsed .playlist-nav-item:hover,
.main-nav.is-collapsed .is-active {
  background: var(--smw-bg-selected);
}

.main-nav.is-collapsed a:hover .nav-icon,
.main-nav.is-collapsed .playlist-nav-item:hover .nav-icon,
.main-nav.is-collapsed .is-active .nav-icon {
  background: transparent;
}

.sidebar-text {
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

.main-nav.is-collapsed .sidebar-text {
  max-width: 0;
  opacity: 0;
  transform: translateX(-6px);
}
</style>
