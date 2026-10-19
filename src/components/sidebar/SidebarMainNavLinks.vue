<script setup lang="ts">
import { Music2, Plug, Search } from '@lucide/vue';
import { t } from '../../i18n';
import type { SidebarMainNavLinksEmits, SidebarMainNavLinksProps } from '../../types/sidebar';
import SidebarPluginLinks from './SidebarPluginLinks.vue';
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
      :is-active="activeView === 'artists' || activeView === 'downloads' || (activeView === 'library' && activeCollection === 'all')"
      :title="t(locale, 'musicLibrary')"
      @navigate="emit('openLibrary')"
    >
      <template #icon><Music2 :size="22" /></template>
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
    <SidebarPluginLinks :collapsed="collapsed" />
  </div>
</template>

<style scoped>
.main-nav-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
