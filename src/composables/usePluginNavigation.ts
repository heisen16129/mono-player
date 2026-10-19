import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch, type InjectionKey, type Ref } from 'vue';
import type { PluginManifest } from '../types/plugin';
import type { AppView } from './useLibraryNavigation';
import { listInstalledPluginManifests } from '../services/plugins';
import { hasPluginSidebarPage } from '../services/pluginPages';
import { PLUGINS_CHANGED_EVENT } from './useMusicSourcePluginAvailability';

function createPluginNavigation(activeView: Ref<AppView>, enabled: () => boolean) {
  const installed = ref<PluginManifest[]>([]);
  const selectedId = ref<string | null>(null);
  const plugins = computed(() => enabled() ? installed.value.filter(plugin => plugin.enabled && hasPluginSidebarPage(plugin)) : []);
  const activePlugin = computed(() => activeView.value === 'plugin-page'
    ? plugins.value.find(plugin => plugin.id === selectedId.value) ?? null : null);
  let generation = 0;

  async function refresh() {
    const current = ++generation;
    const items = await listInstalledPluginManifests().catch(() => []);
    if (current === generation) installed.value = items;
  }

  function openPlugin(id: string) {
    if (!plugins.value.some(plugin => plugin.id === id)) return;
    selectedId.value = id;
    activeView.value = 'plugin-page';
  }

  watch([plugins, selectedId], () => {
    if (activeView.value === 'plugin-page' && !activePlugin.value) activeView.value = 'plugins';
    if (!enabled() && activeView.value === 'plugins') activeView.value = 'library';
  });
  onMounted(() => {
    window.addEventListener(PLUGINS_CHANGED_EVENT, refresh);
    void refresh();
  });
  onBeforeUnmount(() => {
    generation++;
    window.removeEventListener(PLUGINS_CHANGED_EVENT, refresh);
  });
  return { plugins, activePlugin, openPlugin };
}

const key: InjectionKey<ReturnType<typeof createPluginNavigation>> = Symbol('plugin-navigation');

export function providePluginNavigation(activeView: Ref<AppView>, enabled: () => boolean) {
  provide(key, createPluginNavigation(activeView, enabled));
}

export function usePluginNavigation() {
  const navigation = inject(key);
  if (!navigation) throw new Error('Plugin navigation provider is missing');
  return navigation;
}
