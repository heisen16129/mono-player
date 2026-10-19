<script setup lang="ts">
import { AudioLines, Plug, Speaker } from '@lucide/vue';
import { usePluginNavigation } from '../../composables/usePluginNavigation';
import SidebarMainNavLink from './SidebarMainNavLink.vue';

defineProps<{ collapsed: boolean }>();
const { plugins, activePlugin, openPlugin } = usePluginNavigation();
const icons = { speaker: Speaker, 'audio-lines': AudioLines, plug: Plug };
</script>

<template>
  <SidebarMainNavLink
    v-for="plugin in plugins"
    :key="plugin.id"
    :collapsed="collapsed"
    :href="`#plugin/${encodeURIComponent(plugin.id)}`"
    :is-active="activePlugin?.id === plugin.id"
    :title="plugin.sidebar?.title?.trim() || plugin.name"
    @navigate="openPlugin(plugin.id)"
  >
    <template #icon><component :is="icons[plugin.sidebar!.icon]" :size="22" /></template>
  </SidebarMainNavLink>
</template>
