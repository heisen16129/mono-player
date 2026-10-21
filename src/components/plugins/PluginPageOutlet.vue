<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { usePluginNavigation } from '../../composables/usePluginNavigation';
import { connectPluginPage } from '../../services/pluginApiTransport';
import type { InstalledPluginPackage, PluginPackageManifest } from '../../types/pluginPackage';
const props = defineProps<{
  plugin?: InstalledPluginPackage;
  page?: PluginPackageManifest['contributions']['pages'][number];
  embedded?: boolean;
}>();
const navigation = usePluginNavigation();
const activePlugin = computed(() => props.plugin ?? navigation.activePlugin.value);
const activePage = computed(() => props.page ?? navigation.activePage.value);
const frame = ref<HTMLIFrameElement | null>(null);
const error = ref('');
const url = computed(() => {
  const plugin = activePlugin.value;
  const page = activePage.value;
  if (!plugin || !page) return '';
  const base = convertFileSrc('', 'plugin-page').replace(/\/?$/, '/');
  return base + [plugin.id, plugin.packageRevision, ...page.entry.split('/')].map(encodeURIComponent).join('/');
});
let generation = 0;
let disconnect: (() => void) | undefined;
function dispose() { generation++; disconnect?.(); disconnect = undefined; }
async function connect() {
  dispose();
  const current = generation;
  const plugin = activePlugin.value;
  const page = activePage.value;
  if (!frame.value || !plugin || !page) return;
  try {
    const close = await connectPluginPage(frame.value, plugin.id, page.id, plugin.packageRevision);
    if (current !== generation) close(); else disconnect = close;
  } catch (reason) { if (current === generation) error.value = reason instanceof Error ? reason.message : String(reason); }
}
watch(url, () => { dispose(); error.value = ''; }, { flush: 'sync' });
onBeforeUnmount(dispose);
</script>

<template>
  <section class="plugin-page" :class="{ embedded }" :aria-label="activePage?.title">
    <p v-if="error" role="alert">{{ error }}</p>
    <iframe v-if="url" ref="frame" :key="url" :src="url" :title="activePage?.title"
      :allow="(activePlugin?.permissions.includes('speaker-service') || activePlugin?.permissions.includes('service.run')) && activePlugin?.permissions.includes('network') ? 'local-network-access *; local-network *; loopback-network *' : undefined"
      sandbox="allow-scripts" referrerpolicy="no-referrer" @load="connect" />
  </section>
</template>

<style scoped>
.plugin-page { box-sizing: border-box; height: 100%; min-height: 0; display: flex; flex-direction: column; padding-top: 60px; }
.plugin-page.embedded { padding-top: 0; }
iframe { flex: 1; width: 100%; min-height: 0; border: 0; background: var(--smw-bg); }
p { padding: 16px; }
</style>
