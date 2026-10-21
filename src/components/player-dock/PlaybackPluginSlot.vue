<script setup lang="ts">
import { AudioLines, Plug, Speaker } from '@lucide/vue';
import { usePluginNavigation } from '../../composables/usePluginNavigation';
const { playbackEntries, launchPlugin } = usePluginNavigation();
const icons = { speaker: Speaker, 'audio-lines': AudioLines, plug: Plug };
</script>

<template>
  <div v-if="playbackEntries.length" class="playback-plugin-slot" role="group" aria-label="插件快捷入口">
    <button v-for="{ plugin, entry } in playbackEntries" :key="`${plugin.id}:${entry.id}`"
      class="icon-button" type="button" :title="entry.title" :aria-label="entry.title"
      @click.stop="launchPlugin(plugin, entry, 'dialog')">
      <component :is="icons[entry.icon as keyof typeof icons] || Plug" :size="18" />
    </button>
  </div>
</template>

<style scoped>
.playback-plugin-slot { display: flex; align-items: center; gap: 8px; }
</style>
