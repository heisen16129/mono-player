<script setup lang="ts">
import { AudioLines, Plug, Speaker } from '@lucide/vue';
import { usePluginNavigation } from '../../composables/usePluginNavigation';
import SidebarMainNavLink from './SidebarMainNavLink.vue';

defineProps<{ collapsed: boolean }>();
const { sidebarEntries, activePlugin, activePage, launchPlugin } = usePluginNavigation();
const icons = { speaker: Speaker, 'audio-lines': AudioLines, plug: Plug };
</script>

<template>
  <SidebarMainNavLink
    v-for="{ plugin, entry } in sidebarEntries"
    :key="`${plugin.id}:${entry.id}`"
    :collapsed="collapsed"
    :href="`#plugin/${encodeURIComponent(plugin.id)}`"
    :is-active="activePlugin?.id === plugin.id && activePage?.id === entry.pageId"
    :title="entry.title"
    @navigate="launchPlugin(plugin, entry, 'page')"
  >
    <template #icon><component :is="icons[entry.icon as keyof typeof icons] || Plug" :size="22" /></template>
  </SidebarMainNavLink>
</template>
