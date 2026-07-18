<script setup lang="ts">
import {
  CirclePlus,
  Download,
  Heart,
  Music2,
  Plus,
  Plug,
  Search,
  Settings,
  Shirt,
  Clock3,
  UserRound,
} from '@lucide/vue';
import { onBeforeUnmount, ref } from 'vue';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { UserPlaylist } from '../types/music';

const player = usePlayerStore();
const isPlaylistListScrolling = ref(false);
let playlistListScrollTimer: number | undefined;

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

function handlePlaylistListScroll() {
  isPlaylistListScrolling.value = true;
  window.clearTimeout(playlistListScrollTimer);
  playlistListScrollTimer = window.setTimeout(() => {
    isPlaylistListScrolling.value = false;
  }, 800);
}

onBeforeUnmount(() => {
  window.clearTimeout(playlistListScrollTimer);
});
</script>

<template>
  <aside class="primary-sidebar" :class="{ collapsed }">
    <div class="brand">
      <button
        class="brand-mark brand-mark-button"
        type="button"
        :aria-label="collapsed ? 'Mono Player' : 'Mono Player'"
        :title="collapsed ? 'Mono Player' : 'Mono Player'"
        @click="collapsed && emit('toggleCollapsed')"
      >
        <span class="brand-letter">M</span>
        <svg class="brand-expand-glyph" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="3" />
          <path d="M10.75 4.75v10.5" />
        </svg>
      </button>
      <strong class="sidebar-text">Mono Player</strong>
      <button
        v-if="!collapsed"
        class="icon-button collapse-button"
        type="button"
        :aria-label="t(player.settings.locale, 'collapseSidebar')"
        :title="t(player.settings.locale, 'collapseSidebar')"
        @click="emit('toggleCollapsed')"
      >
        <svg class="collapse-glyph" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="3" />
          <path d="M9.25 4.75v10.5" />
        </svg>
      </button>
    </div>

    <nav class="main-nav" aria-label="Main navigation">
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
        :title="t(player.settings.locale, 'localMusic')"
        @click.prevent="emit('openLibrary')"
      >
        <span class="nav-icon"><Music2 :size="22" /></span><span class="sidebar-text">{{ t(player.settings.locale, 'localMusic') }}</span>
      </a>
      <a
        :class="{ 'is-active': activeView === 'artists' }"
        href="#artists"
        :title="t(player.settings.locale, 'artists')"
        @click.prevent="emit('openArtists')"
      >
        <span class="nav-icon"><UserRound :size="22" /></span><span class="sidebar-text">{{ t(player.settings.locale, 'artists') }}</span>
      </a>
      <a
        :class="{ 'is-active': activeView === 'library' && activeLibraryFilter === 'recentAdded' }"
        href="#recent-added"
        :title="t(player.settings.locale, 'recentAdded')"
        @click.prevent="emit('openRecentAdded')"
      >
        <span class="nav-icon"><CirclePlus :size="22" /></span><span class="sidebar-text">{{ t(player.settings.locale, 'recentAdded') }}</span>
      </a>
      <a
        :class="{ 'is-active': activeView === 'library' && activeLibraryFilter === 'recentPlayed' }"
        href="#recent-played"
        :title="t(player.settings.locale, 'recentPlayed')"
        @click.prevent="emit('openRecentPlayed')"
      >
        <span class="nav-icon"><Clock3 :size="22" /></span><span class="sidebar-text">{{ t(player.settings.locale, 'recentPlayed') }}</span>
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
          :aria-label="player.settings.locale === 'en-US' ? 'Create playlist' : '创建歌单'"
          :title="player.settings.locale === 'en-US' ? 'Create playlist' : '创建歌单'"
          @click="emit('createPlaylist')"
        >
          <Plus :size="17" />
        </button>
      </span>
      <a
        :class="{ 'is-active': activeView === 'library' && activeCollection === 'favorites' }"
        href="#favorites"
        :title="t(player.settings.locale, 'favorites')"
        @click.prevent="emit('openFavorites')"
      >
        <span class="nav-icon"><Heart :size="22" /></span><span class="sidebar-text">{{ t(player.settings.locale, 'favorites') }}</span>
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

    <div class="account">
      <span class="avatar" aria-hidden="true">
        <UserRound :size="20" />
        <i></i>
      </span>
      <span class="account-meta sidebar-text">
        <strong>Mono</strong>
        <small>{{ t(player.settings.locale, 'online') }}</small>
      </span>
      <button
        class="icon-button"
        :class="{ 'is-active': activeView === 'settings' }"
        type="button"
        :aria-label="t(player.settings.locale, 'settings')"
        :title="t(player.settings.locale, 'settings')"
        @click="emit('openSettings')"
      >
        <Settings :size="18" />
      </button>
      <button
        class="icon-button"
        type="button"
        :class="{ 'is-active': activeView === 'themes' }"
        :aria-label="t(player.settings.locale, 'themes')"
        :title="t(player.settings.locale, 'themes')"
        @click="emit('openTheme')"
      >
        <Shirt :size="18" />
      </button>
    </div>
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

.brand {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
  font-size: 17px;
  transition:
    gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.primary-sidebar.collapsed .brand {
  grid-template-columns: 38px;
  justify-content: start;
  gap: 10px;
  padding: 0 0 0 14px;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--smw-border-strong);
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
}

.brand-letter,
.brand-expand-glyph {
  grid-area: 1 / 1;
  transition:
    opacity 120ms ease,
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand-expand-glyph {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  opacity: 0;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.45;
  transform: scale(0.86);
}

.brand-mark-button {
  padding: 0;
  border: 0;
  appearance: none;
  cursor: default;
}

.primary-sidebar.collapsed .brand-mark-button {
  cursor: pointer;
}

.primary-sidebar.collapsed .brand-mark-button:hover .brand-letter,
.primary-sidebar.collapsed .brand-mark-button:focus-visible .brand-letter {
  opacity: 0;
  transform: scale(0.86);
}

.primary-sidebar.collapsed .brand-mark-button:hover .brand-expand-glyph,
.primary-sidebar.collapsed .brand-mark-button:focus-visible .brand-expand-glyph {
  opacity: 1;
  transform: scale(1);
}

.collapse-button {
  width: 34px;
  height: 38px;
  color: var(--smw-icon-muted);
}

.collapse-glyph {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.45;
}

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

.primary-sidebar.collapsed .nav-section-break {
  width: 58px;
  margin: 5px 0 6px;
  grid-template-columns: 58px;
}

.primary-sidebar.collapsed .nav-divider {
  display: none;
}

.primary-sidebar.collapsed .nav-add-button {
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

.primary-sidebar.collapsed .main-nav a,
.primary-sidebar.collapsed .playlist-nav-item {
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

.primary-sidebar.collapsed .main-nav a:hover,
.primary-sidebar.collapsed .playlist-nav-item:hover,
.primary-sidebar.collapsed .main-nav .is-active {
  background: var(--smw-bg-selected);
}

.primary-sidebar.collapsed .main-nav a:hover .nav-icon,
.primary-sidebar.collapsed .playlist-nav-item:hover .nav-icon,
.primary-sidebar.collapsed .main-nav .is-active .nav-icon {
  background: transparent;
}

.icon-button.is-active {
  background: var(--smw-bg-selected);
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

.brand > .sidebar-text {
  max-width: none;
}

.primary-sidebar.collapsed .main-nav .sidebar-text {
  max-width: 0;
  opacity: 0;
  transform: translateX(-6px);
}

.primary-sidebar.collapsed .brand .sidebar-text,
.primary-sidebar.collapsed .account .sidebar-text {
  display: none;
}

.account {
  position: relative;
  display: block;
  height: 52px;
  margin-top: auto;
  padding: 18px 6px 0;
  border-top: 1px solid var(--smw-border);
  transition:
    height 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.primary-sidebar.collapsed .account {
  height: 142px;
  width: 100%;
  padding-inline: 12px 0;
}

.avatar {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  color: var(--smw-avatar-fg);
  background: linear-gradient(145deg, var(--smw-avatar-bg), var(--smw-avatar-bg-deep));
  box-shadow: inset 0 0 0 1px var(--smw-avatar-border);
  transform: translateZ(0);
}

.account > .avatar {
  position: absolute;
  top: 18px;
}

.account > .avatar {
  left: 12px;
}

.account > .avatar svg {
  display: block;
  width: 20px;
  height: 20px;
  transform: translateZ(0);
}

.account > .icon-button {
  position: absolute;
  top: 18px;
  transition:
    top 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    left 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account > .icon-button:nth-of-type(1) {
  left: calc(100% - 74px);
}

.account > .icon-button:nth-of-type(2) {
  left: calc(100% - 34px);
}

.primary-sidebar.collapsed .account > .icon-button {
  left: 12px;
}

.primary-sidebar.collapsed .account > .icon-button:nth-of-type(1) {
  top: 62px;
}

.primary-sidebar.collapsed .account > .icon-button:nth-of-type(2) {
  top: 106px;
}

.account strong,
.account small {
  display: block;
}

.account-meta {
  position: absolute;
  top: 18px;
  left: 50px;
  display: grid;
  gap: 2px;
  line-height: 1.15;
}

.account strong {
  font-size: 13px;
  font-weight: 560;
}

.account small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.avatar i {
  position: absolute;
  right: -2px;
  bottom: 0;
  width: 13px;
  height: 13px;
  border: 2px solid var(--smw-avatar-status-border);
  border-radius: 50%;
  background: var(--smw-status-green);
}
</style>
