<script setup lang="ts">
import { CirclePlus, Clock3, Download, Music2, Plug, Search, UserRound } from '@lucide/vue';
import { t } from '../../i18n';
import type { SidebarMainNavLinksEmits, SidebarMainNavLinksProps } from '../../types/sidebar';
import SidebarMainNavLink from './SidebarMainNavLink.vue';

defineProps<SidebarMainNavLinksProps>();

const emit = defineEmits<SidebarMainNavLinksEmits>();
</script>

<template>
  <div class="main-nav-links" :class="{ 'is-collapsed': collapsed }">
    <SidebarMainNavLink
      v-if="enablePlugins && hasMusicSourcePlugin"
      :collapsed="collapsed"
      href="#discover"
      :is-active="activeView === 'discover'"
      title="发现音乐"
      @navigate="emit('openDiscover')"
    >
      <template #icon><Search :size="22" /></template>
    </SidebarMainNavLink>
    <SidebarMainNavLink
      :collapsed="collapsed"
      href="#library"
      :is-active="activeView === 'library' && activeCollection === 'all' && activeLibraryFilter === 'all'"
      :title="t(locale, 'localMusic')"
      @navigate="emit('openLibrary')"
    >
      <template #icon><Music2 :size="22" /></template>
    </SidebarMainNavLink>
    <SidebarMainNavLink
      :collapsed="collapsed"
      href="#artists"
      :is-active="activeView === 'artists'"
      :title="t(locale, 'artists')"
      @navigate="emit('openArtists')"
    >
      <template #icon><UserRound :size="22" /></template>
    </SidebarMainNavLink>
    <SidebarMainNavLink
      :collapsed="collapsed"
      href="#recent-added"
      :is-active="activeView === 'library' && activeLibraryFilter === 'recentAdded'"
      :title="t(locale, 'recentAdded')"
      @navigate="emit('openRecentAdded')"
    >
      <template #icon><CirclePlus :size="22" /></template>
    </SidebarMainNavLink>
    <SidebarMainNavLink
      :collapsed="collapsed"
      href="#recent-played"
      :is-active="activeView === 'library' && activeLibraryFilter === 'recentPlayed'"
      :title="t(locale, 'recentPlayed')"
      @navigate="emit('openRecentPlayed')"
    >
      <template #icon><Clock3 :size="22" /></template>
    </SidebarMainNavLink>
    <SidebarMainNavLink
      v-if="showDownloads"
      :collapsed="collapsed"
      href="#downloads"
      :is-active="activeView === 'downloads'"
      title="下载管理"
      @navigate="emit('openDownloads')"
    >
      <template #icon><Download :size="22" /></template>
    </SidebarMainNavLink>
    <SidebarMainNavLink
      v-if="enablePlugins"
      :collapsed="collapsed"
      href="#plugins"
      :is-active="activeView === 'plugins'"
      title="插件管理"
      @navigate="emit('openPlugins')"
    >
      <template #icon><Plug :size="22" /></template>
    </SidebarMainNavLink>
  </div>
</template>

<style scoped>
.main-nav-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
