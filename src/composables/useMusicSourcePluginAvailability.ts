import { computed, onMounted, onUnmounted, ref, watch, type ComputedRef } from 'vue';
import { listInstalledPlugins } from '../services/plugins';

export const PLUGINS_CHANGED_EVENT = 'mono:plugins-changed';

export function useMusicSourcePluginAvailability(pluginsEnabled: ComputedRef<boolean>) {
  const hasInstalledMusicSourcePlugin = ref(false);

  async function refreshMusicSourcePluginAvailability() {
    if (!pluginsEnabled.value) {
      hasInstalledMusicSourcePlugin.value = false;
      return;
    }

    const plugins = await listInstalledPlugins().catch(() => []);
    hasInstalledMusicSourcePlugin.value = plugins.some((plugin) => (
      plugin.enabled
      && plugin.kind === 'music'
      && plugin.capabilities.includes('search')
      && plugin.capabilities.includes('play')
    ));
  }

  function handlePluginsChanged() {
    void refreshMusicSourcePluginAvailability();
  }

  onMounted(() => {
    window.addEventListener(PLUGINS_CHANGED_EVENT, handlePluginsChanged);
    void refreshMusicSourcePluginAvailability();
  });

  onUnmounted(() => {
    window.removeEventListener(PLUGINS_CHANGED_EVENT, handlePluginsChanged);
  });

  watch(pluginsEnabled, () => {
    void refreshMusicSourcePluginAvailability();
  });

  const hasMusicSourcePlugin = computed(() => pluginsEnabled.value && hasInstalledMusicSourcePlugin.value);

  return {
    hasMusicSourcePlugin,
    refreshMusicSourcePluginAvailability,
  };
}
