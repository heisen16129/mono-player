<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { listInstalledPluginManifests } from '../../services/plugins';
import { usePlayerStore } from '../../stores/player';
import type { PluginManifest } from '../../types/plugin';
import { PLUGINS_CHANGED_EVENT } from '../../composables/useMusicSourcePluginAvailability';
import { getPlaybackBarLaunchers } from '../plugins/pluginLaunchers';

const player = usePlayerStore();
const plugins = ref<PluginManifest[]>([]);
const entries = computed(() => player.settings.enablePlugins
  ? plugins.value.filter(plugin => plugin.enabled).flatMap(plugin =>
    getPlaybackBarLaunchers(plugin).map(launcher => ({ plugin, launcher })))
  : []);
let generation = 0;

async function refresh() {
  const current = ++generation;
  const installed = await listInstalledPluginManifests().catch(() => []);
  if (current === generation) plugins.value = installed;
}

onMounted(() => {
  window.addEventListener(PLUGINS_CHANGED_EVENT, refresh);
  void refresh();
});
onBeforeUnmount(() => {
  generation++;
  window.removeEventListener(PLUGINS_CHANGED_EVENT, refresh);
});
</script>

<template>
  <div v-if="entries.length" class="playback-plugin-slot" role="group" aria-label="插件快捷入口">
    <component v-for="{ plugin, launcher } in entries" :is="launcher.component" :key="`${plugin.id}:${launcher.capability}`" :plugin-id="plugin.id">
      <template #default="{ open }">
        <button class="icon-button" type="button" :title="plugin.name" :aria-label="`打开${plugin.name}`" @click.stop="open">
          <component :is="launcher.icon" :size="18" />
        </button>
      </template>
    </component>
  </div>
</template>

<style scoped>
.playback-plugin-slot { display: flex; align-items: center; gap: 8px; }
</style>
