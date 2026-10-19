<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import StemSeparationPage from '../stem-separation/StemSeparationPage.vue';
import { usePluginNavigation } from '../../composables/usePluginNavigation';
import { resolvePluginPage } from '../../services/pluginPages';
import { usePluginWindowDrag } from '../../composables/usePluginWindowDrag';

const { activePlugin } = usePluginNavigation();
const pageAction = computed(() => {
  const page = activePlugin.value?.sidebar?.page;
  return page && 'action' in page ? page.action : null;
});
const url = ref('');
const error = ref('');
const loading = ref(false);
const frame = ref<HTMLIFrameElement | null>(null);
usePluginWindowDrag(frame, url, () => activePlugin.value?.sidebar?.page && 'action' in activePlugin.value.sidebar.page ? true : false);
let generation = 0;

async function load() {
  const current = ++generation;
  url.value = '';
  error.value = '';
  const plugin = activePlugin.value;
  if (!plugin) return;
  loading.value = true;
  try {
    const result = await resolvePluginPage(plugin);
    if (current === generation) url.value = result;
  } catch (reason) {
    if (current === generation) error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (current === generation) loading.value = false;
  }
}

watch(activePlugin, load, { immediate: true });
onBeforeUnmount(() => { generation++; });
</script>

<template>
  <section class="plugin-page" :class="{ 'has-integrated-header': pageAction === 'speaker-control' }" :aria-label="activePlugin?.name">
    <StemSeparationPage v-if="pageAction === 'stem-separation' && activePlugin" :key="activePlugin.id" :plugin-id="activePlugin.id" />
    <p v-else-if="loading" role="status">正在打开插件页面…</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
    <iframe v-else-if="url" ref="frame" :key="url" :src="url" :title="activePlugin?.name" :sandbox="activePlugin?.sidebar && 'action' in activePlugin.sidebar.page ? 'allow-scripts allow-same-origin allow-forms allow-popups' : 'allow-scripts allow-forms allow-popups'" referrerpolicy="no-referrer" />
  </section>
</template>

<style scoped>
.plugin-page {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Reserve the host window controls (12px top + 40px height) and an 8px gap. */
  padding-top: 60px;
}
iframe { flex: 1; width: 100%; min-height: 0; border: 0; background: var(--smw-bg); }
.plugin-page.has-integrated-header { padding-top: 0; }
p { padding: 24px; }
button { cursor: pointer; }
</style>
